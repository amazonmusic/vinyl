/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentType } from '../../streaming/MediaQualityMetadata'
import type { ContentTypesValue } from '../../streaming/ContentTypesValue'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { HlsManifestData } from './HlsManifestProvider'
import type { MainPlaylist } from '@amazon/vinyl-hls-parser'
import { codecsToContentTypes } from '../mse/codec'

export interface HlsContentTypesValueDeps {
    readonly manifestTransformed: ObservableValue<Promise<HlsManifestData>>
}

/**
 * Creates an ObservableValue for the content types present in the HLS manifest.
 *
 * Per RFC 8216 §4.3.4.2, content types are determined from:
 * 1. The CODECS attribute on EXT-X-STREAM-INF (variant streams)
 * 2. The TYPE attribute on EXT-X-MEDIA (alternative renditions)
 */
export function createHlsContentTypesValue(
    deps: HlsContentTypesValueDeps
): ContentTypesValue {
    return deps.manifestTransformed.map(async (manifestData) => {
        return getContentTypes((await manifestData).mainPlaylist)
    })
}

function getContentTypes(mainPlaylist: MainPlaylist): Set<ContentType> {
    const contentTypes = new Set<ContentType>()

    // Derive content types from variant CODECS attributes.
    // Only audio and video are relevant for MSE; text (subtitles/CC) is not
    // appended via SourceBuffer in HLS.
    for (const variant of mainPlaylist.variants) {
        if (variant.codecs) {
            for (const type of codecsToContentTypes(variant.codecs)) {
                if (type === 'audio' || type === 'video') {
                    contentTypes.add(type)
                }
            }
        }
    }

    // Add audio/video from separate renditions not already covered by variant codecs.
    for (const rendition of mainPlaylist.alternativeRenditions) {
        if (rendition.type === 'AUDIO') contentTypes.add('audio')
        if (rendition.type === 'VIDEO') contentTypes.add('video')
    }

    return contentTypes
}
