/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    TrackBase,
    type TrackBaseDeps,
    type TrackBaseOptions,
    trackBaseOptionsValidator,
} from '../TrackBase'
import type {
    TrackEventMap,
    TrackPreloadOptions,
    TrackTypeId,
    TrackUri,
} from '../Track'
import { FixedPlaybackQuality } from './FixedPlaybackQuality'
import {
    logDebug,
    type Maybe,
    type ReadonlySet,
    redispatchEvents,
} from '@amazon/vinyl-util'
import {
    type ContentType,
    createEmptyMediaQualityMetadata,
    type MediaQualityMetadata,
    mediaQualityMetadataValidator,
} from '../../streaming/MediaQualityMetadata'
import type { ObjectSchema } from '@amazon/vinyl-validation'

export interface SourceTrackBaseOptions extends TrackBaseOptions {
    /**
     * Quality metadata.
     * May be used to configure DRM (for native HLS), codec, or other track metadata.
     */
    readonly qualityMetadata?: Maybe<Partial<MediaQualityMetadata>>
}

export const sourceTrackBaseOptionsValidator: ObjectSchema<SourceTrackBaseOptions> =
    trackBaseOptionsValidator.extend({
        qualityMetadata: mediaQualityMetadataValidator
            .partial()
            .maybe()
            .optional(),
    })

const emptyMediaQualityMetadata: MediaQualityMetadata =
    createEmptyMediaQualityMetadata()

export abstract class SourceTrackBase<
    SrcType,
    EventMap extends TrackEventMap = TrackEventMap,
    LoadOptionsType extends SourceTrackBaseOptions = SourceTrackBaseOptions,
> extends TrackBase<EventMap, LoadOptionsType> {
    private readonly fixedPlaybackQuality: FixedPlaybackQuality
    private _resolvedSrc: SrcType | null = null

    protected constructor(
        uri: TrackUri,
        type: TrackTypeId,
        public readonly src: Promise<SrcType>,
        protected readonly deps: TrackBaseDeps
    ) {
        super(uri, type, deps)
        const add = this.disposer.add
        this.src
            .then((src) => {
                this._resolvedSrc = src
                if (this.active) this.setSrc(src)
            })
            .catch(this.errorHandler)
        this.fixedPlaybackQuality = add(
            new FixedPlaybackQuality(emptyMediaQualityMetadata, deps)
        )
        this.fixedPlaybackQuality.on('bufferingQualityChange', (event) => {
            this.deps.drmController.setBufferingDrmInfo(
                event.current,
                this.drmSessionAbort.value
            )
        })
        redispatchEvents(this, this.fixedPlaybackQuality, [
            'streamingQualityChange',
            'bufferingQualityChange',
            'playbackQualityChange',
        ])
    }

    preload(trackOptions: TrackPreloadOptions, loadOptions: LoadOptionsType) {
        super.preload(trackOptions, loadOptions)
        this.fixedPlaybackQuality.fixedQuality = {
            ...emptyMediaQualityMetadata,
            ...loadOptions.qualityMetadata,
        }
    }

    get contentTypes(): ReadonlySet<ContentType> {
        return this.fixedPlaybackQuality.contentTypes
    }

    get qualities(): readonly MediaQualityMetadata[] | null {
        return null
    }

    get qualitiesUnfiltered(): readonly MediaQualityMetadata[] | null {
        return null
    }

    getStreamingQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.fixedPlaybackQuality.getStreamingQuality(contentType)
    }

    getBufferingQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.fixedPlaybackQuality.getBufferingQuality(contentType)
    }

    getPlaybackQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.fixedPlaybackQuality.getPlaybackQuality(contentType)
    }

    onActivated(): void {
        this.fixedPlaybackQuality.activate()
        this.deps.drmController.initializeForPlayback(
            this.fixedPlaybackQuality.fixedQuality,
            this.drmSessionAbort.value
        )
        if (this._resolvedSrc != null) this.setSrc(this._resolvedSrc)
    }

    protected abstract setSrc(src: SrcType): void
    protected abstract clearSrc(): void

    onDeactivated(): void {
        if (this._resolvedSrc != null) this.clearSrc()
        this.fixedPlaybackQuality.deactivate()
    }

    clearPrefetch() {
        // Source tracks do not prefetch
        logDebug(this, 'clearPrefetch no-op')
    }
}
