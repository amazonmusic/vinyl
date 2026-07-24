/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import {
    supportsMse,
    type HlsManifestData,
    type VinylTrackLoadOptions,
} from '@amazon/vinyl'
import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import { resolveUrl } from '@amazon/vinyl-util'

/**
 * Integration tests for HLS Interstitial (SGAI) ad-break support.
 *
 * There is no DMTestAssetBuilder fixture that carries EXT-X-DATERANGE
 * interstitials yet, so these tests wrap a real generated HLS asset with a
 * `manifestProvider` that injects, into each fetched media playlist:
 *
 *   - an EXT-X-PROGRAM-DATE-TIME anchor on the first segment, and
 *   - an interstitial EXT-X-DATERANGE (CLASS="com.apple.hls.interstitial")
 *     whose START-DATE lands MIDROLL_TIME seconds after that anchor.
 *
 * This exercises the full path — parser → discoverHlsInterstitials →
 * AdController → VinylPlayer events — against a stream that actually decodes
 * and plays, so enter/exit can be observed by driving the real playhead.
 */
describe('hls ad interstitials integ', () => {
    // Anchor wall clock and the media-timeline offset of the injected break.
    const ANCHOR_ISO = '2024-01-01T00:00:00.000Z'
    const ANCHOR_MS = Date.parse(ANCHOR_ISO)
    const MIDROLL_TIME = 20
    const MIDROLL_DURATION = 6
    const AD_ID = 'integ-midroll-1'
    const AD_ASSET = 'https://ads.example.com/interstitial.m3u8'

    /**
     * Builds a manifestProvider for the given main-playlist URL that fetches
     * the real playlists and rewrites media playlists to carry a program
     * date-time anchor plus a single mid-roll interstitial.
     */
    function injectingManifestProvider(
        mainUrl: string
    ): () => Promise<HlsManifestData> {
        return async () => {
            const mainText = await (await fetch(mainUrl)).text()
            const mainPlaylist = parseMainPlaylist(mainText)
            const cache = new Map<
                string,
                ReturnType<typeof parseMediaPlaylist>
            >()
            return {
                mainPlaylist,
                baseUrl: mainUrl,
                getMediaPlaylist: async (uri: string) => {
                    const cached = cache.get(uri)
                    if (cached) return cached
                    const url = resolveUrl(uri, mainUrl)
                    const text = await (await fetch(url)).text()
                    const injected = injectInterstitial(text)
                    const parsed = parseMediaPlaylist(injected)
                    cache.set(uri, parsed)
                    return parsed
                },
            }
        }
    }

    /**
     * Inserts a PROGRAM-DATE-TIME before the first segment line and an
     * interstitial DATERANGE into a media playlist's header.
     */
    function injectInterstitial(text: string): string {
        const startDate = new Date(
            ANCHOR_MS + MIDROLL_TIME * 1000
        ).toISOString()
        const dateRange =
            `#EXT-X-DATERANGE:ID="${AD_ID}",` +
            `CLASS="com.apple.hls.interstitial",` +
            `START-DATE="${startDate}",DURATION=${MIDROLL_DURATION},` +
            `X-ASSET-URI="${AD_ASSET}"`
        const lines = text.split(/\r?\n/)
        const out: string[] = []
        let anchored = false
        for (const line of lines) {
            // Anchor the first media segment (first EXTINF) with a PDT.
            if (!anchored && line.startsWith('#EXTINF')) {
                out.push(`#EXT-X-PROGRAM-DATE-TIME:${ANCHOR_ISO}`)
                anchored = true
            }
            out.push(line)
        }
        // DATERANGE is a playlist-level tag; place it just after the header.
        out.splice(1, 0, dateRange)
        return out.join('\n')
    }

    const suite = createVinylSuite({}, { timeout: 180 })

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    function makePlaylist(): VinylTrackLoadOptions[] {
        return [
            {
                type: 'hls',
                uri: 'integ-interstitial',
                manifestProvider: injectingManifestProvider(
                    vinylTestAssets.hls.live_static_video_audio_60s_2s
                ),
            },
        ]
    }

    async function loadAndAwaitAdBreaks(): Promise<void> {
        suite.player.load(...makePlaylist())
        const deadline = Date.now() + 15_000
        while (suite.player.adBreaks.length === 0 && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
    }

    it('discovers the injected interstitial as an ad break', async () => {
        await loadAndAwaitAdBreaks()
        const breaks = suite.player.adBreaks
        expect(breaks.length).toBe(1)
        expect(breaks[0].id).toBe(AD_ID)
        expect(breaks[0].startTime).toBeCloseTo(MIDROLL_TIME, 1)
        expect(breaks[0].duration).toBe(MIDROLL_DURATION)
        expect(breaks[0].placement).toBe('midroll')
        expect(breaks[0].ads[0].uri).toBe(AD_ASSET)
    })

    it('emits adBreakChange as the playhead crosses into and out of the break', async () => {
        await loadAndAwaitAdBreaks()
        if (suite.player.adBreaks.length === 0) {
            pending('no ad breaks discovered')
        }
        const player = suite.player
        const entered: string[] = []
        const exited: string[] = []
        const changeSub = player.on('adBreakChange', (e) => {
            if (e.current) entered.push(e.current.id)
            else if (e.previous) exited.push(e.previous.id)
        })

        try {
            // Seek just before the break, then play through it.
            await player.seekTo(MIDROLL_TIME - 1, 0.5)
            await player.play()

            const deadline = Date.now() + 30_000
            while (
                (entered.length === 0 || exited.length === 0) &&
                Date.now() < deadline
            ) {
                await new Promise((r) => setTimeout(r, 100))
            }

            expect(entered).toContain(AD_ID)
            expect(exited).toContain(AD_ID)
        } finally {
            changeSub()
        }
    })

    it('reports the active ad break while the playhead is inside it', async () => {
        await loadAndAwaitAdBreaks()
        if (suite.player.adBreaks.length === 0) {
            pending('no ad breaks discovered')
        }
        const player = suite.player
        // Seek into the middle of the break and play so timeUpdate fires and
        // drives the active-region detection.
        await player.seekTo(MIDROLL_TIME + MIDROLL_DURATION / 2, 0.5)
        await player.play()
        const deadline = Date.now() + 15_000
        while (player.activeAdBreak == null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        expect(player.activeAdBreak?.id).toBe(AD_ID)
    })
})
