/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A basic HLS main playlist with multiple variants and alternative renditions.
 */
export const hls_mainPlaylist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,AUTOSELECT=NO,URI="audio/es.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="subtitles/en.m3u8"

#EXT-X-STREAM-INF:BANDWIDTH=1280000,CODECS="avc1.42e00a,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=29.97,AUDIO="audio",SUBTITLES="subs"
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2560000,CODECS="avc1.42e01e,mp4a.40.2",RESOLUTION=854x480,FRAME-RATE=29.97,AUDIO="audio",SUBTITLES="subs"
mid/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=7680000,CODECS="avc1.42e01f,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=29.97,AUDIO="audio",SUBTITLES="subs"
high/index.m3u8`
