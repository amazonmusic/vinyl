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
import { mediaRef } from '@/player/mediaRef'
import { requireUserInteraction } from '@/ui/requireUserInteraction'
import { unlockMediaElement } from '@/media/unlockMediaElement'
import { setNextTestTimeout } from '@amazon/vinyl-util/browserTestUtil'

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
        | 32
        | 64
        | 128
        | 256
        | 512
        | 1024
        | 2048
        | 4096
        | 8192
        | 16384
        | 32768
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
 * Displays an interaction prompt if checkAudio is present in the query params.
 *
 * The checkAudio query param, if present, indicates that the actual sound output should be analyzed. This requires
 * a user gesture unless the UA doesn't require it. Most browsers require the gesture, but some platforms this
 * requirement may be skipped with a flag. Note that Google deprecated --autoplay-policy=no-user-gesture-required
 * March 2023, but older versions may still support it.
 */
export function initializeFrequencyAnalyzer() {
    if (shouldCheckAudio) {
        // If a user interaction is required, give extra time to interact before a timeout.
        setNextTestTimeout(300)
        beforeAll(async () => {
            // Creates the audio context and 'unlocks' the media element in response to a user gesture.
            const media = mediaRef.value
            media.crossOrigin = 'anonymous'
            media.muted = false
            media.volume = 0.01 // Save your ears. Analyzers do not work at volume 0 or muted; measured dB is affected.
            await requireUserInteraction()
            const audioContext = getAudioContext()
            await unlockMediaElement()

            if (audioContext) {
                const source = audioContext.createMediaElementSource(
                    mediaRef.value
                )
                frequencyAnalyzer = new FrequencyAnalyzer(audioContext, source)
            } else {
                console.warn('AudioContext not supported')
            }
        })
    }
}
