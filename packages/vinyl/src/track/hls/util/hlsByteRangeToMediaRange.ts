/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ByteRange } from '@amazon/vinyl-mpd-parser'
import type { HlsByteRange } from '@amazon/vinyl-hls-parser'

/** Converts an HLS byte range (`{offset, length}`) to a `ByteRange` (`[start, end]`). */
export function hlsByteRangeToMediaRange(byteRange: HlsByteRange): ByteRange {
    return [byteRange.offset, byteRange.offset + byteRange.length - 1]
}
