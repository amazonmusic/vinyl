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
 * Uses a real HLS asset with injected EXT-X-DATERANGE interstitials to
 * test the full pipeline: discovery → AdController → MseTrack → playback.
 */
describe('hls ad interstitials integ', () => {
    const ANCHOR_ISO = '2024-01-01T00:00:00.000Z'
    const ANCHOR_MS = Date.parse(ANCHOR_ISO)
    const MIDROLL_TIME = 20
    const MIDROLL_DURATION = 6
    const AD_ID = 'integ-midroll-1'
    const AD_ASSET = 'https://ads.example.com/interstitial.m3u8'

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
            if (!anchored && line.startsWith('#EXTINF')) {
                out.push(`#EXT-X-PROGRAM-DATE-TIME:${ANCHOR_ISO}`)
                anchored = true
            }
            out.push(line)
        }
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

    // ─── Acceptance: Ad breaks are discovered from timeline ──────────────
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

    // ─── Acceptance: adBreakChange fires on enter/exit ───────────────────
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

    // ─── Acceptance: activeAdBreak reflects state ────────────────────────
    it('reports the active ad break while the playhead is inside it', async () => {
        await loadAndAwaitAdBreaks()
        if (suite.player.adBreaks.length === 0) {
            pending('no ad breaks discovered')
        }
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + MIDROLL_DURATION / 2, 0.5)
        await player.play()
        const deadline = Date.now() + 15_000
        while (player.activeAdBreak == null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        expect(player.activeAdBreak?.id).toBe(AD_ID)
    })

    // ─── Acceptance: skipAd clears active break ──────────────────────────
    it('skipAd clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        if (suite.player.adBreaks.length === 0) {
            pending('no ad breaks discovered')
        }
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        const deadline = Date.now() + 15_000
        while (player.activeAdBreak == null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        expect(player.activeAdBreak).not.toBeNull()
        player.skipAd()
        expect(player.activeAdBreak).toBeNull()
    })

    // ─── Acceptance: skipAdBreak clears active break ─────────────────────
    it('skipAdBreak clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        if (suite.player.adBreaks.length === 0) {
            pending('no ad breaks discovered')
        }
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        const deadline = Date.now() + 15_000
        while (player.activeAdBreak == null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        expect(player.activeAdBreak).not.toBeNull()
        player.skipAdBreak()
        expect(player.activeAdBreak).toBeNull()
    })

    // ─── Acceptance: seekRange resolves from timeline ─────────────────────
    it('exposes seekRange once the timeline resolves', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        const deadline = Date.now() + 15_000
        while (player.seekRange == null && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        expect(player.seekRange).not.toBeNull()
        expect(player.seekRange!.start).toBeGreaterThanOrEqual(0)
        expect(player.seekRange!.end).toBeGreaterThan(0)
    })

    // ─── Acceptance: AdBreakInfo has typed restrict/assetListUrl ──────────
    it('ad breaks have strongly typed fields (no metadata)', async () => {
        await loadAndAwaitAdBreaks()
        const adBreak = suite.player.adBreaks[0]
        // Verify the shape - no 'metadata' property
        expect('metadata' in adBreak).toBeFalse()
        // restrict and assetListUrl are the typed alternatives
        expect(adBreak.restrict).toBeUndefined()
        expect(adBreak.assetListUrl).toBeUndefined()
    })

    // ─── Acceptance: adController is on VinylDeps (player-level) ─────────
    it('ad events come from the player-level controller (not per-track)', async () => {
        const player = suite.player
        const spy = jasmine.createSpy('adBreaksChange')
        const sub = player.on('adBreaksChange', spy)
        player.load(...makePlaylist())
        const deadline = Date.now() + 15_000
        while (spy.calls.count() === 0 && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        sub()
        expect(spy).toHaveBeenCalled()
        expect(spy.calls.mostRecent().args[0].current.length).toBe(1)
    })
})
