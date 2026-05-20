/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An HLS media playlist with byte ranges and discontinuities.
 */
export const hls_mediaPlaylistWithByteRanges = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0

#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000@0
segment.ts
#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000@1000000
segment.ts
#EXT-X-DISCONTINUITY
#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000@2000000
segment.ts

#EXT-X-ENDLIST`
