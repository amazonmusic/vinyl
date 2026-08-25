/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AlternativeRendition,
    VariantStream,
} from '@amazon/vinyl-hls-parser'
import type { MediaQualityMetadata } from '../../streaming/MediaQualityMetadata'
import { codecToContentType, contentTypeToMimeType } from '../mse/codec'

export type HlsMediaQualityMetadataResolver = (
    variant: VariantStream,
    renditions: readonly AlternativeRendition[]
) => MediaQualityMetadata

export function createDefaultHlsMediaQualityMetadataResolver(): HlsMediaQualityMetadataResolver {
    return (variant, _renditions) => {
        const codecs = variant.codecs || null
        // Use the first codec to determine the primary content type.
        const contentType = codecs
            ? codecToContentType(codecs.split(',')[0])
            : null

        // Use the variant URI as the decoderId so each quality forces a decoder
        // re-initialization on switch.
        return {
            qualityId: `${variant.bandwidth}-${codecs ?? ''}`,
            decoderId: variant.uri,
            groupId: '0',
            switchingGroupIds: null,
            mimeType: contentType
                ? contentTypeToMimeType(contentType, codecs)
                : null,
            contentType,
            codecs,
            bandwidth: null,
            bandwidthTotal: variant.bandwidth,
            audioSamplingRate: null,
            width: variant.width ?? null,
            height: variant.height ?? null,
            frameRate: variant.frameRate
                ? ([variant.frameRate, 1] as const)
                : null,
            // A variant's own language is unknown/irrelevant: demuxed audio
            // carries its language on its rendition (buildHlsMediaTimeline
            // creates one audio quality per rendition), and video is
            // language-agnostic. Muxed variants have a single implicit language.
            lang: null,
            contentProtections: [],
            encryptionScheme: null,
            initDataType: null,
            supplementalProperties: {},
        }
    }
}
