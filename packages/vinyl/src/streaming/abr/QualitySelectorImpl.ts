/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PrefetchState, QualitySelector } from './QualitySelector'
import {
    clamp,
    createDisposer,
    createLogPrefix,
    type Disposable,
    getNetworkMetrics,
    type LogTarget,
    lerp,
} from '@amazon/vinyl-util'
import {
    boolean,
    enumOf,
    number,
    object,
    type ObjectSchema,
} from '@amazon/vinyl-validation'
import type { MediaQualityMetadata } from '../MediaQualityMetadata'
import type { ObservableValue } from '@amazon/vinyl-observable'

export interface QualitySelectorImplOptions {
    /**
     * If at least this amount of time (in seconds) is currently fetched, don't consider an ABR-down.
     * Also used as the upper bound for interpolating between {@link bandwidthMultiplierLow} and
     * {@link bandwidthMultiplierHigh} based on the current fetched time.
     * Default: 15
     */
    readonly highBufferThreshold?: number

    /**
     * If less than this amount of time (in seconds) is currently fetched, don't consider an ABR-up.
     * Default: 4
     */
    readonly lowBufferThreshold?: number

    /**
     * Defines the strategy used for quality selection.
     *
     * Default: BEST (ABR will be enabled)
     */
    readonly strategy?: AbrStrategy

    /**
     * A multiplier applied to the estimated bandwidth when the fetched buffer is empty (0 seconds).
     * Lower values are more conservative (reduce the bandwidth used for quality selection) and help
     * avoid rebuffers when the buffer is low.
     *
     * As the fetched buffer fills toward {@link highBufferThreshold}, the effective multiplier
     * linearly interpolates between this value and {@link bandwidthMultiplierHigh}.
     *
     * Default: 0.4
     */
    readonly bandwidthMultiplierLow?: number

    /**
     * A multiplier applied to the estimated bandwidth when the fetched buffer is at or above
     * {@link highBufferThreshold}. Higher values are more optimistic and allow selection of higher
     * qualities once enough data is buffered to absorb short-term bandwidth dips.
     *
     * As the fetched buffer fills from 0 toward {@link highBufferThreshold}, the effective multiplier
     * linearly interpolates between {@link bandwidthMultiplierLow} and this value.
     *
     * Default: 0.9
     */
    readonly bandwidthMultiplierHigh?: number

    /**
     * When true, avoids changing codecs when considering choosing a higher audio bitrate
     * than what is currently playing. A decoder re-initialization is often an audible change,
     * so consumers that prefer to avoid audible artifacts may enable this. ABR-down is still
     * allowed across decoders because the subtle audio artifact is more desirable than a rebuffer.
     * Default: false
     */
    readonly restrictDecoderChangeOnAudioAbrUp?: boolean
}

export enum AbrStrategy {
    /**
     * Selects lowest quality, regardless of bandwidth conditions.
     */
    LOWEST = 'lowest',

    /**
     * Selects highest quality, regardless of bandwidth conditions.
     */
    HIGHEST = 'highest',

    /**
     * Selects the best quality based on user bandwidth data.
     * Uses an EWMA estimation.
     */
    BEST = 'best',

    /**
     * Selects the initial quality based on bandwidth information, but will not change qualities mid-stream.
     *
     * May choose new quality after streaming clear, such as after a seek.
     */
    FIXED = 'fixed',
}

export const qualitySelectorImplOptionsValidator: ObjectSchema<QualitySelectorImplOptions> =
    object({
        highBufferThreshold: number().optional(),
        lowBufferThreshold: number().optional(),
        strategy: enumOf(AbrStrategy).optional(),
        bandwidthMultiplierLow: number().optional(),
        bandwidthMultiplierHigh: number().optional(),
        restrictDecoderChangeOnAudioAbrUp: boolean().optional(),
    })

export const defaultQualitySelectorImplOptions = {
    highBufferThreshold: 15,
    lowBufferThreshold: 4,
    strategy: AbrStrategy.BEST,
    bandwidthMultiplierLow: 0.4,
    bandwidthMultiplierHigh: 0.9,
    restrictDecoderChangeOnAudioAbrUp: false,
} as const satisfies QualitySelectorImplOptions

export interface QualitySelectorImplDeps {
    readonly options: ObservableValue<QualitySelectorImplOptions>
}

export class QualitySelectorImpl
    implements QualitySelector, LogTarget, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'QualitySelectorImpl'
    }

    readonly logPrefix = createLogPrefix(this)
    private _options: Required<QualitySelectorImplOptions> =
        defaultQualitySelectorImplOptions

    private disposer = createDisposer()

    constructor(deps: QualitySelectorImplDeps) {
        const { add } = this.disposer
        add(
            deps.options.onData((v) => {
                this._options = { ...defaultQualitySelectorImplOptions, ...v }
            })
        )
    }

    get options(): Required<QualitySelectorImplOptions> {
        return this._options
    }

    selectQuality(
        qualities: readonly MediaQualityMetadata[],
        prefetchState: PrefetchState
    ): number {
        const {
            strategy,
            highBufferThreshold,
            lowBufferThreshold,
            bandwidthMultiplierLow,
            bandwidthMultiplierHigh,
            restrictDecoderChangeOnAudioAbrUp,
        } = this.options
        const previousQuality = prefetchState.previousQuality
        // previousIndex will be -1 if the previously playing quality is not within the current qualities list.
        const previousIndex =
            previousQuality == null
                ? -1
                : qualities.findIndex(
                      (quality) =>
                          quality.qualityId === previousQuality.qualityId
                  )

        if (strategy === AbrStrategy.LOWEST) {
            return qualities.length - 1
        } else if (strategy === AbrStrategy.HIGHEST) {
            return 0
        } else if (strategy === AbrStrategy.FIXED) {
            if (previousIndex >= 0) return previousIndex
        }

        const fetchedTime = prefetchState.fetchedTime
        const bandwidthEstimate = getNetworkMetrics().estimatedDownlinkBandwidth
        // Interpolate the bandwidth multiplier between the low and high values based on how much
        // buffer is currently fetched. An empty buffer uses bandwidthMultiplierLow (conservative)
        // to reduce rebuffer risk; a buffer at or above highBufferThreshold uses
        // bandwidthMultiplierHigh (optimistic) since buffered data can absorb short-term dips.
        // The interpolation is linear with respect to the buffer ratio.
        // If the track is not active (i.e. prefetch), always use the high multiplier.
        const bufferRatio =
            highBufferThreshold > 0
                ? clamp(fetchedTime / highBufferThreshold, 0, 1)
                : 1
        const bandwidthMultiplier = prefetchState.active
            ? lerp(bandwidthMultiplierLow, bandwidthMultiplierHigh, bufferRatio)
            : bandwidthMultiplierHigh

        // Choose bandwidth based on pessimistic network information.
        // If the track is active, take the lesser of the latest recorded bandwidth stat and the weighted
        // average to allow for fast ABR-down in variable conditions.
        const bandwidth =
            (prefetchState.active
                ? Math.min(bandwidthEstimate.ewmaLow, bandwidthEstimate.latest)
                : bandwidthEstimate.ewmaLow) * bandwidthMultiplier

        let restrictDecoderId: string | null = null
        let restrictSwitchingGroupIds: readonly string[] | null = null
        if (previousQuality && previousIndex >= 0) {
            // Restrict to qualities whose groupId is in the previous quality's switching group.
            // Null switchingGroupIds means no switching constraint.
            if (previousQuality.switchingGroupIds != null) {
                restrictSwitchingGroupIds = previousQuality.switchingGroupIds
            }

            // Intra-track ABR rules
            if (
                previousQuality.bandwidthTotal &&
                bandwidth < previousQuality.bandwidthTotal
            ) {
                // Measured bandwidth lower than current streaming bandwidth.
                if (fetchedTime >= highBufferThreshold) {
                    // Do not ABR-down inter-track when there is ample fetched data.
                    return previousIndex
                }
            } else {
                if (fetchedTime < lowBufferThreshold) {
                    // Do not ABR-up inter-track when there is not enough fetched data.
                    return previousIndex
                }

                // Measured bandwidth is at least current streaming bandwidth.
                // Restrict to the previous decoder id for audio to avoid an audible artifact
                // from decoder re-initialization.
                if (
                    restrictDecoderChangeOnAudioAbrUp &&
                    previousQuality.contentType === 'audio'
                ) {
                    restrictDecoderId = previousQuality.decoderId
                }
            }
        }
        const index = qualities.findIndex((quality) => {
            if (
                restrictSwitchingGroupIds != null &&
                !restrictSwitchingGroupIds.includes(quality.groupId)
            )
                return false
            if (
                restrictDecoderId != null &&
                quality.decoderId !== restrictDecoderId
            )
                return false
            return (
                quality.bandwidthTotal == null ||
                quality.bandwidthTotal <= bandwidth
            )
        })
        return index === -1 ? qualities.length - 1 : index
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose() {
        this.disposer.dispose()
    }
}
