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
    createAudioDescriptionFilter,
    throwNoPlayableAudio,
} from './mediaTimelineAccessibilityFilter'
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
import type { AudioOptions } from './AudioOptions'

export interface DefaultMediaTimelineTransformerDeps {
    readonly capabilities: Capabilities
    readonly drmController: DrmController
    readonly mediaTimeline: ObservableValue<Promise<MediaTimeline>>
    readonly options: ObservableValue<{
        readonly audio: AudioOptions
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
        // Resolve audio-description eligibility BEFORE the language filter.
        // Description renditions are an accessibility opt-in, not general audio,
        // so they must be gated out (unless opted in via audio.selection.descriptive)
        // before language selection runs. Otherwise a description rendition
        // whose language tag happens to score higher than the main audio's
        // (e.g. a described 'en' beating a main 'en-US') could win language
        // selection and evict the main audio, stranding the listener on
        // described audio they never opted into. With this gate first, the
        // language filter only ever picks among eligible (main, or opted-in
        // description) renditions.
        const selection = deps.options.value.audio.selection
        t = filterTimelineQualities(
            createAudioDescriptionFilter(selection?.descriptive ?? false),
            throwNoPlayableAudio,
            t
        )
        t = filterTimelineQualities(
            createLanguageFilter(selection?.language ?? null, 'audio'),
            throwLanguagesUnsupported,
            t
        )
        return t
    }

    return combineData({
        timeline: deps.mediaTimeline,
        audio: deps.options.pick('audio'),
        codecOverrides: deps.options.pick('codecOverrides'),
    }).map(async ({ timeline }) => {
        return transformTimeline(await timeline)
    })
}
