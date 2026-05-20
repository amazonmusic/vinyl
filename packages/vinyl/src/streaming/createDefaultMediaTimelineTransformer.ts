/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import { combineData } from '@amazon/vinyl-observable'
import type { Capabilities } from '@/client/Capabilities'
import type { DrmController } from '@/drm/DrmController'
import type { MediaTimeline } from '@/streaming/MediaTimeline'
import {
    filterTimelineQualities,
    filterTimelineQualitiesAsync,
} from '@/streaming/mediaTimelineFilter'
import { createLanguageFilter } from '@/streaming/mediaTimelineLanguageFilter'
import {
    canPlayMimeType,
    throwMimeTypesUnsupported,
} from '@/track/filters/resourceTypeFilter'
import {
    canPlayKeySystem,
    throwKeySystemsUnsupported,
} from '@/track/filters/keySystemFilter'
import {
    supportsAudioSamplingRate,
    throwSamplingRatesUnsupported,
} from '@/track/filters/sampleRateFilter'
import { throwLanguagesUnsupported } from '@/track/filters/languageFilter'

export interface DefaultMediaTimelineTransformerDeps {
    readonly capabilities: Capabilities
    readonly drmController: DrmController
    readonly mediaTimeline: ObservableValue<Promise<MediaTimeline>>
    readonly options: ObservableValue<{
        readonly preferredAudioLanguage: string | null
    }>
}

/**
 * The default media timeline transformer filters out unplayable qualities
 * and applies language preferences. Shared by Dash and HLS.
 */
export function createDefaultMediaTimelineTransformer(
    deps: DefaultMediaTimelineTransformerDeps
): ObservableValue<Promise<MediaTimeline>> {
    async function transformTimeline(
        timeline: MediaTimeline
    ): Promise<MediaTimeline> {
        let t = filterTimelineQualities(
            (quality) => canPlayMimeType(deps, quality),
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
    }).map(async ({ timeline }) => {
        return transformTimeline(await timeline)
    })
}
