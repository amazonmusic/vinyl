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
    return (variant, renditions) => {
        const codecs = variant.codecs || null
        // Use the first codec to determine the primary content type.
        const contentType = codecs
            ? codecToContentType(codecs.split(',')[0])
            : null

        // Find matching audio rendition for language.
        const audioRendition = variant.audioGroup
            ? renditions.find(
                  (r) => r.type === 'AUDIO' && r.groupId === variant.audioGroup
              )
            : undefined

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
            lang: audioRendition?.language ?? null,
            contentProtections: [],
            encryptionScheme: null,
            initDataType: null,
            supplementalProperties: {},
        }
    }
}
