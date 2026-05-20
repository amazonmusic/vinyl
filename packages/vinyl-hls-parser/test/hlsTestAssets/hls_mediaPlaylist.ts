/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A basic HLS media playlist with segments and encryption.
 */
export const hls_mediaPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key.bin",IV=0x99b74007b6254e4bd1c6e03631cad15b

#EXTINF:9.009,
segment00000.ts
#EXTINF:9.009,
segment00001.ts
#EXTINF:9.009,
segment00002.ts
#EXTINF:9.009,
segment00003.ts
#EXTINF:9.009,
segment00004.ts
#EXTINF:5.005,
segment00005.ts

#EXT-X-ENDLIST`
