/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createMediaSource, isTypeSupported } from '@amazon/vinyl'
import {
    IllegalStateError,
    requestWithRetry,
    substitute,
} from '@amazon/vinyl-util'
import { type SegmentedAsset, vinylTestAssets } from '../assets/vinylTestAssets'

const mimeCodec = 'audio/mp4;codecs="mp4a.40.5"'

/**
 * Creates a media source with controlled appends, gives the ability to test when playback
 * runs out of data.
 */
export class ControlledMediaSource {
    readonly length: number
    private _currentIndex = 0

    private readonly mediaSource = createMediaSource()
    private readonly sourceBufferPromise: Promise<SourceBuffer>
    private segments: readonly ArrayBuffer[] | null = null

    constructor(
        readonly sourceAsset: SegmentedAsset = vinylTestAssets
            .segmentedStreaming.aac_60s_2ch_16bit_44100Hz_48kbps
    ) {
        this.length = sourceAsset.numSegments + 1
        if (isTypeSupported(mimeCodec)) {
            this.sourceBufferPromise = new Promise((resolve) => {
                this.mediaSource.addEventListener(
                    'sourceopen',
                    () => {
                        this.mediaSource.duration = sourceAsset.duration
                        const sourceBuffer =
                            this.mediaSource.addSourceBuffer(mimeCodec)
                        resolve(sourceBuffer)
                    },
                    { once: true }
                )
            })
        } else {
            throw new Error(`Unsupported MIME type or codec: ${mimeCodec}`)
        }
    }

    /**
     * Gets the data for all segments.
     * All data is preloaded in order to have reproducible test conditions.
     */
    private async getSegments(): Promise<ArrayBuffer[]> {
        // Populate the assets from the template. index 0 - init segment, index 1 through
        // numSegments is sourceAsset.part where {index} is replaced with the index (1-indexed).
        const segments = new Array<ArrayBuffer>(this.length)
        const initResponse = await requestWithRetry(this.sourceAsset.init)
        segments[0] = await initResponse.arrayBuffer()
        for (let i = 1; i <= this.sourceAsset.numSegments; i++) {
            const mediaResponse = await requestWithRetry(
                substitute(this.sourceAsset.part, { index: i })
            )
            segments[i] = await mediaResponse.arrayBuffer()
        }
        return segments
    }

    /**
     * Gets the media source.
     * This promise resolves when all assets are ready.
     * Note: in Firefox, you must set this object url on the element immediately. Creating the
     * URL and setting it later can cause errors.
     */
    async getMediaSource(): Promise<MediaSource> {
        this.segments = await this.getSegments()
        return this.mediaSource
    }

    async appendNext(): Promise<void> {
        if (!this.segments)
            throw new IllegalStateError('cannot append before getMediaSource')
        const sourceBuffer = await this.sourceBufferPromise
        if (this._currentIndex >= this.length)
            throw new Error(`Only ${this.length} segments`)
        const buff = this.segments[this._currentIndex++]
        await onSourceBufferReady(sourceBuffer)
        const updateEnd = onUpdateEnd(sourceBuffer)
        sourceBuffer.appendBuffer(buff)
        await updateEnd
        if (this._currentIndex === this.length) {
            this.mediaSource.endOfStream()
        }
    }
}

async function onSourceBufferReady(sourceBuffer: SourceBuffer): Promise<void> {
    if (!sourceBuffer.updating) return
    await onUpdateEnd(sourceBuffer)
    return onSourceBufferReady(sourceBuffer)
}

/**
 * Resolves on the next updateend event.
 * @param sourceBuffer
 * @private
 */
function onUpdateEnd(sourceBuffer: SourceBuffer): Promise<void> {
    return new Promise((resolve) => {
        sourceBuffer.addEventListener(
            'updateend',
            () => {
                resolve(void 0)
            },
            { once: true }
        )
    })
}
