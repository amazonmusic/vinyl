/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import { combineData } from '@amazon/vinyl-observable'
import type { Capabilities } from '../client/Capabilities'
import type { DrmController } from '../drm/DrmController'
import type { MediaTimeline } from './MediaTimeline'
import {
    filterTimelineQualities,
    filterTimelineQualitiesAsync,
} from './mediaTimelineFilter'
import { createLanguageFilter } from './mediaTimelineLanguageFilter'
import {
    canPlayMimeType,
    throwMimeTypesUnsupported,
} from '../track/filters/resourceTypeFilter'
import {
    canPlayKeySystem,
    throwKeySystemsUnsupported,
} from '../track/filters/keySystemFilter'
import {
    supportsAudioSamplingRate,
    throwSamplingRatesUnsupported,
} from '../track/filters/sampleRateFilter'
import { throwLanguagesUnsupported } from '../track/filters/languageFilter'
import type { CodecOverrides } from '../util/media/codecOverrides'
import { resolveCodecOverride } from '../util/media/codecOverrides'

export interface DefaultMediaTimelineTransformerDeps {
    readonly capabilities: Capabilities
    readonly drmController: DrmController
    readonly mediaTimeline: ObservableValue<Promise<MediaTimeline>>
    readonly options: ObservableValue<{
        readonly preferredAudioLanguage: string | null
        readonly codecOverrides?: CodecOverrides
    }>
}

/**
 * The default media timeline transformer filters out unplayable qualities
 * and applies language preferences. Shared by Dash and HLS.
 */
export function createDefaultMediaTimelineTransformer(
    deps: DefaultMediaTimelineTransformerDeps
): ObservableValue<Promise<MediaTimeline>> {
    /**
     * Applies explicit codec overrides on top of browser support detection.
     * An `'allow'`/`'deny'` override for a quality's codec supersedes
     * {@link canPlayMimeType}; otherwise the browser's support check is used.
     */
    function canPlayWithOverrides(
        quality: Parameters<typeof canPlayMimeType>[1],
        codecOverrides: CodecOverrides | undefined
    ): boolean {
        if (quality.mimeType) {
            const override = resolveCodecOverride(
                quality.mimeType,
                codecOverrides
            )
            if (override === 'allow') return true
            if (override === 'deny') return false
        }
        return canPlayMimeType(deps, quality)
    }

    async function transformTimeline(
        timeline: MediaTimeline
    ): Promise<MediaTimeline> {
        const codecOverrides = deps.options.value.codecOverrides
        let t = filterTimelineQualities(
            (quality) => canPlayWithOverrides(quality, codecOverrides),
            throwMimeTypesUnsupported,
            timeline
        )
        t = await filterTimelineQualitiesAsync(
            (quality) => canPlayKeySystem(deps, quality),
            throwKeySystemsUnsupported,
            t
        )
        t = filterTimelineQualities(
            (quality, index, array) =>
                supportsAudioSamplingRate(deps, quality, index, array),
            throwSamplingRatesUnsupported,
            t
        )
        t = filterTimelineQualities(
            createLanguageFilter(
                deps.options.value.preferredAudioLanguage,
                'audio'
            ),
            throwLanguagesUnsupported,
            t
        )
        return t
    }

    return combineData({
        timeline: deps.mediaTimeline,
        preferredAudioLanguage: deps.options.pick('preferredAudioLanguage'),
        codecOverrides: deps.options.pick('codecOverrides'),
    }).map(async ({ timeline }) => {
        return transformTimeline(await timeline)
    })
}
