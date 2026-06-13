/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadWebVttCues } from '@amazon/vinyl'
import { Abort, requesterWithRetryRef } from '@amazon/vinyl-util'
import { MockRequester } from '@amazon/vinyl-util/testUtil'

describe('loadWebVttCues', () => {
    let requester: MockRequester

    beforeEach(() => {
        requester = new MockRequester()
        requesterWithRetryRef.set(() => requester)
    })

    function respondText(
        body: string,
        contentType?: string,
        url?: string
    ): Promise<Response> {
        const headers = contentType
            ? new Headers({ 'content-type': contentType })
            : new Headers()
        const response = new Response(body, { headers })
        if (url) {
            Object.defineProperty(response, 'url', { value: url })
        }
        return Promise.resolve(response)
    }

    // Common options: a callback receiving cues, and a playhead that keeps
    // moving forward so the buffer window advances past every segment.
    function streamingOpts(overrides: Partial<any> = {}) {
        let now = 0
        const batches: { text: string }[][] = []
        return {
            batches,
            options: {
                onCues: (cs: readonly { text: string }[]) =>
                    batches.push(cs.map((c) => ({ text: c.text }))),
                getCurrentTime: () => now,
                advanceTime: (t: number) => {
                    now = t
                },
                ...overrides,
            },
        }
    }

    it('parses a direct .vtt response with no content-type header', async () => {
        const response = new Response(
            `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nplain`,
            { headers: new Headers() }
        )
        response.headers.delete('content-type')
        requester.request.and.resolveTo(response)
        const { batches, options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub.vtt', options)
        expect(batches.flat().map((c) => c.text)).toEqual(['plain'])
    })

    it('parses a direct .vtt response', async () => {
        const body = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\ndirect`
        requester.request.and.resolveTo(respondText(body, 'text/vtt'))
        const { batches, options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub.vtt', options)
        expect(batches.flat().map((c) => c.text)).toEqual(['direct'])
    })

    it('treats application/x-mpegurl content-type as a media playlist', async () => {
        const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg.vtt
#EXT-X-ENDLIST
`
        const segmentText = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nfrom-segment`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1) {
                return respondText(
                    playlistText,
                    'application/vnd.apple.mpegurl',
                    'https://x.test/sub.m3u8'
                )
            }
            return respondText(segmentText, 'text/vtt')
        })
        const { batches, options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub.txt', options)
        expect(batches.flat().map((c) => c.text)).toEqual(['from-segment'])
    })

    it('falls back to the request URI when response.url is empty (body sniffed)', async () => {
        const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
0.vtt
#EXT-X-ENDLIST
`
        const segText = `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nfb`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1)
                return respondText(
                    playlistText,
                    'application/vnd.apple.mpegurl'
                )
            return respondText(segText)
        })
        // No .m3u8 extension → sniffed via body. Response.url omitted so the
        // fallback branch (response.url || uri) is exercised.
        const { batches, options } = streamingOpts()
        await loadWebVttCues('https://x.test/playlist', options)
        expect(batches.flat().map((c) => c.text)).toEqual(['fb'])
    })

    it('uses response.url when set (m3u8 fetch redirect)', async () => {
        const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
0.vtt
#EXT-X-ENDLIST
`
        const segText = `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nseg`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1) {
                return respondText(
                    playlistText,
                    'application/vnd.apple.mpegurl',
                    'https://cdn.example.com/redirected/sub.m3u8'
                )
            }
            return respondText(segText)
        })
        const { options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub.m3u8', options)
        const segUrl = requester.request.calls.argsFor(1)[0]
        expect(String(segUrl)).toBe('https://cdn.example.com/redirected/0.vtt')
    })

    it('uses response.url when set (sniffed body)', async () => {
        const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
0.vtt
#EXT-X-ENDLIST
`
        const segText = `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nseg`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1) {
                return respondText(
                    playlistText,
                    undefined,
                    'https://cdn.example.com/redirected/sub'
                )
            }
            return respondText(segText)
        })
        const { options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub', options)
        const segUrl = requester.request.calls.argsFor(1)[0]
        expect(String(segUrl)).toBe('https://cdn.example.com/redirected/0.vtt')
    })

    it('detects a media playlist by .m3u8 URL extension', async () => {
        const playlistText = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
0.vtt
#EXT-X-ENDLIST
`
        const segText = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nseg`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1) {
                return respondText(
                    playlistText,
                    'application/vnd.apple.mpegurl'
                )
            }
            return respondText(segText)
        })
        const { batches, options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub.m3u8', options)
        expect(batches.flat().map((c) => c.text)).toEqual(['seg'])
    })

    it('fetches segments incrementally in playhead-first order', async () => {
        // 4 segments × 5s each. Playhead at 12s selects segment c (10-15s)
        // first because its midpoint is closest to the playhead.
        const playlistBody = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
a.vtt
#EXTINF:5.0,
b.vtt
#EXTINF:5.0,
c.vtt
#EXTINF:5.0,
d.vtt
#EXT-X-ENDLIST
`
        const fetched: string[] = []
        let call = 0
        requester.request.and.callFake((url) => {
            call++
            if (call === 1) return respondText(playlistBody)
            const path = String(url).split('/').pop()!
            fetched.push(path)
            return respondText(
                `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${path}`
            )
        })
        const abort = new Abort()
        const batches: string[][] = []
        const promise = loadWebVttCues('https://x.test/sub.m3u8', {
            onCues: (cs) => batches.push(cs.map((c) => c.text)),
            getCurrentTime: () => 12,
            abort,
        })
        // Let the loader consume every segment in the window, then abort.
        await new Promise((r) => setTimeout(r, 50))
        abort.abort()
        await promise
        expect(fetched[0]).toBe('c.vtt')
        expect(batches[0]).toEqual(['c.vtt'])
    })

    it('substitutes EXT-X-DEFINE:IMPORT variables in segment URIs', async () => {
        const playlistBody = `#EXTM3U
#EXT-X-DEFINE:IMPORT="prefix"
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
{$prefix}0.vtt
#EXT-X-ENDLIST
`
        const segText = `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nhello`
        let call = 0
        requester.request.and.callFake((url) => {
            call++
            if (call === 1) return respondText(playlistBody)
            expect(String(url)).toBe('https://cdn.example.com/0.vtt')
            return respondText(segText)
        })
        const { batches, options } = streamingOpts()
        await loadWebVttCues('https://x.test/sub.m3u8', {
            ...options,
            variables: { prefix: 'https://cdn.example.com/' },
        })
        expect(batches.flat().map((c) => c.text)).toEqual(['hello'])
    })

    it('re-evaluates playhead between segment fetches for seek responsiveness', async () => {
        const playlistBody = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
a.vtt
#EXTINF:5.0,
b.vtt
#EXTINF:5.0,
c.vtt
#EXTINF:5.0,
d.vtt
#EXT-X-ENDLIST
`
        const fetched: string[] = []
        let currentTime = 0
        let call = 0
        requester.request.and.callFake((url) => {
            call++
            if (call === 1) return respondText(playlistBody)
            const path = String(url).split('/').pop()!
            fetched.push(path)
            // Seek to the end after seg0; abort will fire after seg3.
            if (fetched.length === 1) currentTime = 17
            return respondText(
                `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${path}`
            )
        })
        const abort = new Abort()
        const promise = loadWebVttCues('https://x.test/sub.m3u8', {
            onCues: () => {},
            getCurrentTime: () => currentTime,
            abort,
        })
        // Let the loader fetch until it idles (no segments in window).
        await new Promise((r) => setTimeout(r, 50))
        abort.abort()
        await promise
        // First fetch was seg0 (nearest 0s). Then seek → 17s makes seg3
        // (mid=17.5) the closest of the remaining {1, 2, 3}.
        expect(fetched[0]).toBe('a.vtt')
        expect(fetched[1]).toBe('d.vtt')
    })

    it('honors abort during idle polling when playhead is outside every window', async () => {
        // 2 segments at 10s+ but playhead sits at 100s (well past). No
        // segment intersects the [-2, +10] buffer window, so the loader
        // idles. Aborting must resolve the load promptly.
        const playlistBody = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
a.vtt
#EXTINF:5.0,
b.vtt
#EXT-X-ENDLIST
`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1) return respondText(playlistBody)
            fail('no segment fetch expected')
            return respondText('')
        })
        const abort = new Abort()
        const promise = loadWebVttCues('https://x.test/sub.m3u8', {
            onCues: () => {},
            getCurrentTime: () => 100,
            abort,
        })
        // Give the polling loop a moment to enter its wait.
        await new Promise((r) => setTimeout(r, 20))
        abort.abort()
        await promise // should not hang
        expect(call).toBe(1)
    })

    it('respects a custom lookAhead window', async () => {
        // With lookAhead=1, only segment 0 (0..5s) overlaps [-2, 1].
        // Segment 1 (5..10s) is outside the window and never fetched
        // because the playhead never advances.
        const playlistBody = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
a.vtt
#EXTINF:5.0,
b.vtt
#EXT-X-ENDLIST
`
        let call = 0
        const fetched: string[] = []
        requester.request.and.callFake((url) => {
            call++
            if (call === 1) return respondText(playlistBody)
            fetched.push(String(url).split('/').pop()!)
            return respondText(`WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nx`)
        })
        const abort = new Abort()
        const promise = loadWebVttCues('https://x.test/sub.m3u8', {
            onCues: () => {},
            getCurrentTime: () => 0,
            lookAhead: 1,
            abort,
        })
        // Let a.vtt fetch, then let the loader enter its idle poll before
        // aborting so the remaining segment stays pending.
        await new Promise((r) => setTimeout(r, 20))
        abort.abort()
        await promise
        expect(fetched).toEqual(['a.vtt'])
    })
})
