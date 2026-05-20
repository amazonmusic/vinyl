/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDisposer, type LogTarget } from '@amazon/vinyl-util'
import {
    logDebug,
    createLogPrefix,
    EventHostImpl,
    closeTo,
} from '@amazon/vinyl-util'
import type {
    LoudnessNormalizationController,
    LoudnessNormalizationControllerEventMap,
} from './LoudnessNormalizationController'
import {
    defaultLoudnessNormalizationControllerImplOptions,
    type LoudnessNormalizationControllerImplOptions,
} from './LoudnessNormalizationControllerImplOptions'
import type { ObservableValue } from '@amazon/vinyl-observable'

export type LoudnessNormalizationControllerImplDeps = {
    readonly options: ObservableValue<LoudnessNormalizationControllerImplOptions>
}

const DECIBEL_EXPONENT_BASE = Math.pow(10, 1 / 10)
const MAX_GAIN_LEVEL = 1.0

/**
 * Applies gain adjustment based on track loudness metadata from manifest.
 * This controller normalizes audio loudness to a target level for consistent playback volume.
 */
export class LoudnessNormalizationControllerImpl
    extends EventHostImpl<LoudnessNormalizationControllerEventMap>
    implements LoudnessNormalizationController, LogTarget
{
    get [Symbol.toStringTag](): string {
        return 'LoudnessNormalizationControllerImpl'
    }
    readonly logPrefix = createLogPrefix(this)

    private _gain: number = MAX_GAIN_LEVEL
    private readonly disposer = createDisposer()

    private trackLoudness: number | null = null
    private _options: Required<LoudnessNormalizationControllerImplOptions> =
        defaultLoudnessNormalizationControllerImplOptions

    constructor(
        private readonly deps: LoudnessNormalizationControllerImplDeps
    ) {
        super()
        const { add } = this.disposer
        add(
            deps.options.onData((value) => {
                this._options = {
                    ...defaultLoudnessNormalizationControllerImplOptions,
                    ...value,
                }
                this.updateGain()
            })
        )
    }

    get options(): Required<LoudnessNormalizationControllerImplOptions> {
        return this._options
    }

    setTrackLoudness(value: number | null): void {
        this.trackLoudness = value
        this.updateGain()
    }

    /**
     * Returns the loudness gain value which needs to be applied, for current track playback.
     */
    public get gain(): number {
        return this._gain
    }

    /**
     * Sets the loudness gain value for current track playback.
     *
     * @param value New gain value to apply
     */
    private set gain(value: number) {
        const previousGain = this._gain
        // Emit change event if gain value changed
        if (!closeTo(previousGain, value)) {
            this._gain = value
            logDebug(this, 'loudness gain adjustment:', {
                trackLoudness: this.trackLoudness,
                targetLufs: this.options.targetLufs,
                gain: value,
            })
            this.dispatch('change', {})
        }
    }

    /**
     * Update gain value based on current track loudness and target loudness.
     */
    private updateGain(): void {
        const { targetLufs, maxGainDb, enabled } = this.options
        const trackLoudness = this.trackLoudness
        if (trackLoudness == null) {
            return
        }
        if (trackLoudness <= targetLufs || !enabled) {
            this.clear()
            return
        }
        // Calculate gain reduction for louder tracks
        const dbReduction = Math.min(trackLoudness - targetLufs, maxGainDb)
        this.gain =
            MAX_GAIN_LEVEL / Math.pow(DECIBEL_EXPONENT_BASE, dbReduction)
    }

    /**
     * Resets the loudness gain Value to max gain value.
     */
    clear(): void {
        this.gain = MAX_GAIN_LEVEL
    }

    dispose(): void {
        super.dispose()
        this.disposer.dispose()
    }
}
