/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAudioContext } from '@amazon/vinyl'
import { type LogTarget, TimeoutError } from '@amazon/vinyl-util'
import { sleep } from '@amazon/vinyl-util'
import { parseBoolean } from '@amazon/vinyl-util'
import { logDebug } from '@amazon/vinyl-util'
import { getSearchParams } from '@amazon/vinyl-util'
import { createLogPrefix } from '@amazon/vinyl-util'
import { mediaRef } from '../player/mediaRef'

/**
 * The percent tolerance the time estimate based on the analyzed frequency can be off from the actual currentTime.
 */
const TIME_ESTIMATE_TOLERANCE = 0.02

export interface FrequencyAnalyzerOptions {
    /**
     * The frequency the sweep starts at.
     */
    readonly startFrequency: number

    /**
     * The frequency the sweep ends at.
     */
    readonly endFrequency: number

    /**
     * The window size in samples. Default: 4096.
     * A higher value will result in more details in the frequency domain but fewer details in the amplitude domain.
     */
    readonly fftSize:
        32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32768
}

const defaultFrequencyAnalyzerOptions = {
    startFrequency: 100,
    endFrequency: 6000,
    fftSize: 4096,
} as const satisfies FrequencyAnalyzerOptions

export class FrequencyAnalyzer implements LogTarget {
    private readonly data: Float32Array<ArrayBuffer>
    private readonly analyser: AnalyserNode

    private readonly options: FrequencyAnalyzerOptions

    readonly logPrefix = createLogPrefix('FrequencyAnalyzer')

    constructor(
        private readonly audioContext: AudioContext,
        private readonly source: MediaElementAudioSourceNode,
        options?: Partial<FrequencyAnalyzerOptions>
    ) {
        this.options = {
            ...defaultFrequencyAnalyzerOptions,
            ...options,
        }
        // Set up the AnalyserNode
        this.analyser = this.audioContext.createAnalyser()
        this.analyser.fftSize = this.options.fftSize
        this.analyser.connect(this.audioContext.destination)
        this.data = new Float32Array(this.analyser.frequencyBinCount)
        this.source.connect(this.analyser)
    }

    /**
     * Estimates the frequency of the current frame window.
     *
     * The frequency estimate is the frequency of the highest decibel bin within the frame window. The number of
     * bins is 1/2 the fftSize.
     */
    get frequency(): number {
        const audioCtx = this.audioContext
        const analyser = this.analyser
        const data = this.data
        analyser.getFloatFrequencyData(data)
        const maxIndex = data.reduce(
            (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
            0
        )
        return (maxIndex * audioCtx.sampleRate) / analyser.fftSize
    }

    get estimatedTime(): number {
        const frequency = this.frequency
        const start = this.options.startFrequency
        const end = this.options.endFrequency
        return (
            ((frequency - start) / (end - start)) *
            this.source.mediaElement.duration
        )
    }

    /**
     * Asserts that the next samples of audio plays at its expected frequency.
     */
    async assertFrequency(timeout = 10) {
        // Reconnect the analyzer to clear the buffer
        this.analyser.disconnect()
        this.analyser.connect(this.audioContext.destination)

        const media = this.source.mediaElement
        if (isNaN(media.duration)) fail('media is not loaded')
        if (media.paused) fail('media is paused')
        const startTime = Date.now()
        const mediaStartTime = media.currentTime
        // The minimum amount of time to fill the buffer up with data from the time the frequency assertion is
        // requested.
        const playbackTime = 0.25

        const maxDifference = media.duration * TIME_ESTIMATE_TOLERANCE

        // Check if there is enough time remaining in track to accurately test frequency.
        if (media.currentTime + playbackTime >= media.duration) {
            logDebug(
                this,
                'Ignoring assertFrequency, currentTime is at duration'
            )
            return
        }

        let estimatedTime: number
        let diff: number
        let elapsed: number
        do {
            if (Date.now() - startTime > timeout * 1000) {
                throw new TimeoutError(
                    'Frequency data could not be filled, media is not playing.'
                )
            }
            elapsed = media.currentTime - mediaStartTime
            estimatedTime = this.estimatedTime
            diff = Math.abs(estimatedTime - media.currentTime)
            await sleep(playbackTime)
        } while (elapsed < playbackTime && diff > maxDifference)

        logDebug(
            this,
            'time from frequency:',
            estimatedTime.toFixed(2),
            'actual time:',
            media.currentTime.toFixed(2)
        )
        if (diff > maxDifference) {
            const percentFormatter = new Intl.NumberFormat('en-US', {
                style: 'percent',
            })
            fail(
                `The measured frequency at time ${media.currentTime.toFixed(2)} ` +
                    `was measured to be ${this.frequency.toFixed(2)}Hz. ` +
                    `The expected time is ${estimatedTime.toFixed(2)}, the actual time ` +
                    `is ${media.currentTime.toFixed(2)}, ` +
                    `for a difference of ${percentFormatter.format(
                        diff / media.duration
                    )} track duration. (Tolerance is ${percentFormatter.format(TIME_ESTIMATE_TOLERANCE)})`
            )
        }
    }
}

/**
 * The volume integ tests play at when checkAudio is set. Analyzers do not work at volume 0 or muted, and the
 * measured dB is affected at very low volumes.
 */
export const ANALYZER_VOLUME = 0.01

/**
 * A query param, if present, will indicate that audio should be analyzed. Does not work in CI environments.
 */
export const shouldCheckAudio = parseBoolean(
    (getSearchParams().get('checkAudio') ?? '0').toLowerCase()
)

let frequencyAnalyzer: FrequencyAnalyzer | null = null

/**
 * If `shouldCheckAudio` is true and AudioContext is supported, asserts that the currently playing media is playing
 * the frequency expected from the sweep tone of the test assets.
 */
export function assertFrequency(): Promise<void> {
    return frequencyAnalyzer?.assertFrequency() ?? Promise.resolve()
}

/**
 * Attaches an analyzer to the shared media element if checkAudio is present in the query params.
 *
 * The checkAudio query param, if present, indicates that the actual sound output should be analyzed. The analyzer is
 * created after the media element is unlocked, so `initializeMediaUnlock` must be called first.
 */
export function initializeFrequencyAnalyzer() {
    if (!shouldCheckAudio) return
    beforeAll(() => {
        const media = mediaRef.value
        media.crossOrigin = 'anonymous'
        media.volume = ANALYZER_VOLUME
        const audioContext = getAudioContext()
        if (audioContext) {
            const source = audioContext.createMediaElementSource(media)
            frequencyAnalyzer = new FrequencyAnalyzer(audioContext, source)
        } else {
            console.warn('AudioContext not supported')
        }
    })
}
