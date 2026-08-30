/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capabilities } from '../../client/Capabilities'
import type { MediaFormatMetadata } from '../../streaming/MediaQualityMetadata'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

export function throwMimeTypesUnsupported(): never {
    throw new MediaUnsupportedError(
        'No resource type supported (container/codec).',
        'resource-type'
    )
}

/**
 * Returns true when the media's codec and container is supported.
 *
 * Both ISO-BMFF (MP4/fMP4) and WebM containers are supported: the DASH
 * `SegmentBase` indexer reads ISO-BMFF `sidx` boxes or WebM EBML `Cues` as
 * appropriate, and MSE appends each to a matching SourceBuffer.
 */
export function canPlayMimeType(
    deps: { readonly capabilities: Capabilities },
    metadata: MediaFormatMetadata
): boolean {
    if (!metadata.mimeType) return false
    return deps.capabilities.canPlayTypeMse(metadata.mimeType)
}
