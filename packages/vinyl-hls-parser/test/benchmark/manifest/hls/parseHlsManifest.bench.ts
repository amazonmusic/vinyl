/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { addBenchmarks, setupBenchmark } from '@/setup'

const sampleMainPlaylist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,AUTOSELECT=YES,URI="audio/es/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="French",LANGUAGE="fr",DEFAULT=NO,AUTOSELECT=YES,URI="audio/fr/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="German",LANGUAGE="de",DEFAULT=NO,AUTOSELECT=YES,URI="audio/de/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Italian",LANGUAGE="it",DEFAULT=NO,AUTOSELECT=YES,URI="audio/it/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Portuguese",LANGUAGE="pt",DEFAULT=NO,AUTOSELECT=YES,URI="audio/pt/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Japanese",LANGUAGE="ja",DEFAULT=NO,AUTOSELECT=YES,URI="audio/ja/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Korean",LANGUAGE="ko",DEFAULT=NO,AUTOSELECT=YES,URI="audio/ko/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Chinese",LANGUAGE="zh",DEFAULT=NO,AUTOSELECT=YES,URI="audio/zh/64k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-64",NAME="Russian",LANGUAGE="ru",DEFAULT=NO,AUTOSELECT=YES,URI="audio/ru/64k/index.m3u8"

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-128",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en/128k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-128",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,AUTOSELECT=YES,URI="audio/es/128k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-128",NAME="French",LANGUAGE="fr",DEFAULT=NO,AUTOSELECT=YES,URI="audio/fr/128k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-128",NAME="German",LANGUAGE="de",DEFAULT=NO,AUTOSELECT=YES,URI="audio/de/128k/index.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aacl-128",NAME="Italian",LANGUAGE="it",DEFAULT=NO,AUTOSELECT=YES,URI="audio/it/128k/index.m3u8"

#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="subtitles/en/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/es/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="French",LANGUAGE="fr",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/fr/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="German",LANGUAGE="de",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/de/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Italian",LANGUAGE="it",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/it/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Portuguese",LANGUAGE="pt",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/pt/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Japanese",LANGUAGE="ja",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/ja/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Korean",LANGUAGE="ko",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/ko/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Chinese",LANGUAGE="zh",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/zh/index.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Russian",LANGUAGE="ru",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles/ru/index.m3u8"

#EXT-X-STREAM-INF:BANDWIDTH=400000,AVERAGE-BANDWIDTH=380000,CODECS="avc1.42e00a,mp4a.40.2",RESOLUTION=416x234,FRAME-RATE=23.976,AUDIO="audio-aacl-64",SUBTITLES="subs"
video/400k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,AVERAGE-BANDWIDTH=760000,CODECS="avc1.42e015,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=23.976,AUDIO="audio-aacl-64",SUBTITLES="subs"
video/800k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,AVERAGE-BANDWIDTH=1140000,CODECS="avc1.42e01e,mp4a.40.2",RESOLUTION=854x480,FRAME-RATE=23.976,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/1200k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1800000,AVERAGE-BANDWIDTH=1710000,CODECS="avc1.42e01f,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=23.976,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/1800k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,AVERAGE-BANDWIDTH=2375000,CODECS="avc1.42e020,mp4a.40.2",RESOLUTION=1280x720,FRAME-RATE=29.97,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/2500k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3500000,AVERAGE-BANDWIDTH=3325000,CODECS="avc1.42e028,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=23.976,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/3500k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,AVERAGE-BANDWIDTH=4750000,CODECS="avc1.42e028,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=29.97,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/5000k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=7500000,AVERAGE-BANDWIDTH=7125000,CODECS="avc1.42e032,mp4a.40.2",RESOLUTION=1920x1080,FRAME-RATE=59.94,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/7500k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=10000000,AVERAGE-BANDWIDTH=9500000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=3840x2160,FRAME-RATE=23.976,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/10000k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=15000000,AVERAGE-BANDWIDTH=14250000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=3840x2160,FRAME-RATE=29.97,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/15000k/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=20000000,AVERAGE-BANDWIDTH=19000000,CODECS="avc1.640032,mp4a.40.2",RESOLUTION=3840x2160,FRAME-RATE=59.94,AUDIO="audio-aacl-128",SUBTITLES="subs"
video/20000k/index.m3u8`

const sampleMediaPlaylist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/keys/key1.bin",IV=0x99b74007b6254e4bd1c6e03631cad15b

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
#EXTINF:9.009,
segment00005.ts
#EXTINF:9.009,
segment00006.ts
#EXTINF:9.009,
segment00007.ts
#EXTINF:9.009,
segment00008.ts
#EXTINF:9.009,
segment00009.ts
#EXTINF:9.009,
segment00010.ts
#EXTINF:9.009,
segment00011.ts
#EXTINF:9.009,
segment00012.ts
#EXTINF:9.009,
segment00013.ts
#EXTINF:9.009,
segment00014.ts
#EXTINF:9.009,
segment00015.ts
#EXTINF:9.009,
segment00016.ts
#EXTINF:9.009,
segment00017.ts
#EXTINF:9.009,
segment00018.ts
#EXTINF:9.009,
segment00019.ts

#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/keys/key2.bin",IV=0x12345678901234567890123456789012

#EXTINF:9.009,
segment00020.ts
#EXTINF:9.009,
segment00021.ts
#EXTINF:9.009,
segment00022.ts
#EXTINF:9.009,
segment00023.ts
#EXTINF:9.009,
segment00024.ts
#EXTINF:9.009,
segment00025.ts
#EXTINF:9.009,
segment00026.ts
#EXTINF:9.009,
segment00027.ts
#EXTINF:9.009,
segment00028.ts
#EXTINF:9.009,
segment00029.ts

#EXT-X-DISCONTINUITY
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/keys/key3.bin",IV=0xabcdef1234567890abcdef1234567890

#EXTINF:9.009,
segment00030.ts
#EXTINF:9.009,
segment00031.ts
#EXTINF:9.009,
segment00032.ts
#EXTINF:9.009,
segment00033.ts
#EXTINF:9.009,
segment00034.ts
#EXTINF:9.009,
segment00035.ts
#EXTINF:9.009,
segment00036.ts
#EXTINF:9.009,
segment00037.ts
#EXTINF:9.009,
segment00038.ts
#EXTINF:9.009,
segment00039.ts
#EXTINF:9.009,
segment00040.ts
#EXTINF:9.009,
segment00041.ts
#EXTINF:9.009,
segment00042.ts
#EXTINF:9.009,
segment00043.ts
#EXTINF:9.009,
segment00044.ts
#EXTINF:9.009,
segment00045.ts
#EXTINF:9.009,
segment00046.ts
#EXTINF:9.009,
segment00047.ts
#EXTINF:9.009,
segment00048.ts
#EXTINF:9.009,
segment00049.ts

#EXT-X-KEY:METHOD=NONE

#EXTINF:9.009,
segment00050.ts
#EXTINF:9.009,
segment00051.ts
#EXTINF:9.009,
segment00052.ts
#EXTINF:9.009,
segment00053.ts
#EXTINF:9.009,
segment00054.ts
#EXTINF:9.009,
segment00055.ts
#EXTINF:9.009,
segment00056.ts
#EXTINF:9.009,
segment00057.ts
#EXTINF:9.009,
segment00058.ts
#EXTINF:9.009,
segment00059.ts
#EXTINF:9.009,
segment00060.ts
#EXTINF:9.009,
segment00061.ts
#EXTINF:9.009,
segment00062.ts
#EXTINF:9.009,
segment00063.ts
#EXTINF:9.009,
segment00064.ts
#EXTINF:9.009,
segment00065.ts
#EXTINF:9.009,
segment00066.ts
#EXTINF:9.009,
segment00067.ts
#EXTINF:9.009,
segment00068.ts
#EXTINF:9.009,
segment00069.ts
#EXTINF:9.009,
segment00070.ts
#EXTINF:9.009,
segment00071.ts
#EXTINF:9.009,
segment00072.ts
#EXTINF:9.009,
segment00073.ts
#EXTINF:9.009,
segment00074.ts
#EXTINF:9.009,
segment00075.ts
#EXTINF:9.009,
segment00076.ts
#EXTINF:9.009,
segment00077.ts
#EXTINF:9.009,
segment00078.ts
#EXTINF:9.009,
segment00079.ts
#EXTINF:9.009,
segment00080.ts
#EXTINF:9.009,
segment00081.ts
#EXTINF:9.009,
segment00082.ts
#EXTINF:9.009,
segment00083.ts
#EXTINF:9.009,
segment00084.ts
#EXTINF:9.009,
segment00085.ts
#EXTINF:9.009,
segment00086.ts
#EXTINF:9.009,
segment00087.ts
#EXTINF:9.009,
segment00088.ts
#EXTINF:9.009,
segment00089.ts
#EXTINF:9.009,
segment00090.ts
#EXTINF:9.009,
segment00091.ts
#EXTINF:9.009,
segment00092.ts
#EXTINF:9.009,
segment00093.ts
#EXTINF:9.009,
segment00094.ts
#EXTINF:9.009,
segment00095.ts
#EXTINF:9.009,
segment00096.ts
#EXTINF:9.009,
segment00097.ts
#EXTINF:9.009,
segment00098.ts
#EXTINF:5.005,
segment00099.ts

#EXT-X-ENDLIST`

describe('parseHlsManifest', () => {
    setupBenchmark()

    it('Parse HLS Main Playlist', async () => {
        addBenchmarks(
            'Parse HLS Main Playlist',
            await benchmark('HLS Main', () =>
                parseMainPlaylist(sampleMainPlaylist)
            )
        )
    })

    it('Parse HLS Media Playlist', async () => {
        addBenchmarks(
            'Parse HLS Media Playlist',
            await benchmark('HLS Media', () =>
                parseMediaPlaylist(sampleMediaPlaylist)
            )
        )
    })
})
