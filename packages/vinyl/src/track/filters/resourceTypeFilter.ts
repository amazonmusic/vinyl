/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capabilities } from '../../client/Capabilities'
import type { MediaFormatMetadata } from '../../streaming/MediaQualityMetadata'
import { MediaUnsupportedError } from '@amazon/vinyl-util'
import { mimeSubtype } from '../../util/media/mimeType'

export function throwMimeTypesUnsupported(): never {
    throw new MediaUnsupportedError(
        'No resource type supported (container/codec).',
        'resource-type'
    )
}

/**
 * Container subtypes Vinyl's media pipeline does not support.
 *
 * Vinyl targets ISO-BMFF (MP4/fMP4). WebM/Matroska is out of scope: the DASH
 * `SegmentBase` indexer reads ISO-BMFF `sidx` boxes (WebM indexes via EBML
 * `Cues`), and the append pipeline is fMP4-oriented. A browser MSE support
 * check (`canPlayTypeMse`) still reports WebM as playable on e.g. Chrome, so it
 * must be excluded explicitly. Dropping WebM lets mixed-container manifests
 * (WebM + MP4) fall back to their MP4 renditions rather than failing.
 */
const UNSUPPORTED_CONTAINER_SUBTYPES = ['webm', 'x-matroska'] as const

/**
 * Returns true when the mime type's container is one Vinyl can play.
 */
function isSupportedContainer(mimeType: string): boolean {
    return !UNSUPPORTED_CONTAINER_SUBTYPES.includes(
        mimeSubtype(mimeType) as (typeof UNSUPPORTED_CONTAINER_SUBTYPES)[number]
    )
}

/**
 * Returns true when the media's codec and container is supported.
 */
export function canPlayMimeType(
    deps: { readonly capabilities: Capabilities },
    metadata: MediaFormatMetadata
): boolean {
    if (!metadata.mimeType) return false
    if (!isSupportedContainer(metadata.mimeType)) return false
    return deps.capabilities.canPlayTypeMse(metadata.mimeType)
}
