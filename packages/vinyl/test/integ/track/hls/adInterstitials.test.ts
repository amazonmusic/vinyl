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
 * These run in a real browser against real HLS assets. A manifest provider
 * injects EXT-X-DATERANGE interstitials into the content's media playlists so
 * the full pipeline is exercised end-to-end:
 *
 *   discovery → AdController (model) → TrackController (ad track lifecycle)
 *   → real ad playback on the shared media element → content resume.
 *
 * The injected ads point at a real, playable HLS asset so ad tracks genuinely
 * load and play. A `content` asset distinct from the `ad` asset lets tests tell
 * which is on screen (by URI / video dimensions / playhead behaviour).
 */
describe('hls ad interstitials integ', () => {
    const ANCHOR_ISO = '2024-01-01T00:00:00.000Z'
    const ANCHOR_MS = Date.parse(ANCHOR_ISO)

    // Real, playable assets. Content and ad differ so we can distinguish them.
    const CONTENT_ASSET = vinylTestAssets.hls.live_static_video_audio_60s_4s
    const AD_ASSET = vinylTestAssets.hls.live_static_video_audio_60s_2s

    interface Interstitial {
        readonly id: string
        /** Media-timeline start in seconds (relative to the PDT anchor). */
        readonly startTime: number
        readonly duration: number
        /** A single ad via X-ASSET-URI. */
        readonly assetUri?: string
        /** Multiple ads via X-ASSET-LIST (served through a blob/data URL). */
        readonly assetList?: readonly { uri: string; duration: number }[]
        readonly cue?: 'PRE' | 'POST'
    }

    /**
     * Builds an HLS manifest provider that fetches the real content manifest
     * and injects the given interstitials into every media playlist it serves.
     */
    function injectingManifestProvider(
        mainUrl: string,
        interstitials: readonly Interstitial[]
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
                    const injected = injectInterstitials(text, interstitials)
                    const parsed = parseMediaPlaylist(injected)
                    cache.set(uri, parsed)
                    return parsed
                },
            }
        }
    }

    function injectInterstitials(
        text: string,
        interstitials: readonly Interstitial[]
    ): string {
        const dateRanges = interstitials.map((it) => {
            const startDate = new Date(
                ANCHOR_MS + it.startTime * 1000
            ).toISOString()
            let asset: string
            if (it.assetList) {
                // Encode the asset list as a data URL so it is fetchable
                // without a network round-trip.
                const json = JSON.stringify({
                    ASSETS: it.assetList.map((a) => ({
                        URI: a.uri,
                        DURATION: a.duration,
                    })),
                })
                const dataUrl = 'data:application/json;base64,' + btoa(json)
                asset = `X-ASSET-LIST="${dataUrl}"`
            } else {
                asset = `X-ASSET-URI="${it.assetUri}"`
            }
            const cue = it.cue ? `,CUE="${it.cue}"` : ''
            return (
                `#EXT-X-DATERANGE:ID="${it.id}",` +
                `CLASS="com.apple.hls.interstitial",` +
                `START-DATE="${startDate}",DURATION=${it.duration},` +
                `${asset}${cue}`
            )
        })
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
        out.splice(1, 0, ...dateRanges)
        return out.join('\n')
    }

    const MIDROLL_TIME = 20
    const MIDROLL_DURATION = 6
    const AD_ID = 'integ-midroll-1'

    // Default single-midroll playlist used by the model-level acceptance tests.
    function makePlaylist(): VinylTrackLoadOptions[] {
        return [
            {
                type: 'hls',
                uri: 'integ-interstitial',
                manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                    {
                        id: AD_ID,
                        startTime: MIDROLL_TIME,
                        duration: MIDROLL_DURATION,
                        assetUri: AD_ASSET,
                    },
                ]),
            },
        ]
    }

    const suite = createVinylSuite({}, { timeout: 180 })

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    async function poll(
        predicate: () => boolean,
        timeoutMs = 30_000
    ): Promise<boolean> {
        const deadline = Date.now() + timeoutMs
        while (!predicate() && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50))
        }
        return predicate()
    }

    async function loadAndAwaitAdBreaks(
        playlist: VinylTrackLoadOptions[] = makePlaylist()
    ): Promise<void> {
        suite.player.load(...playlist)
        await poll(() => suite.player.adBreaks.length > 0, 15_000)
    }

    // ─── Discovery ───────────────────────────────────────────────────────
    it('discovers the injected interstitial as an ad break', async () => {
        await loadAndAwaitAdBreaks()
        const breaks = suite.player.adBreaks
        expect(breaks.length).toBe(1)
        expect(breaks[0].id).toBe(AD_ID)
        expect(breaks[0].startTime).toBeCloseTo(MIDROLL_TIME, 1)
        expect(breaks[0].duration).toBe(MIDROLL_DURATION)
        expect(breaks[0].placement).toBe('midroll')
        const ads = await breaks[0].ads()
        expect(ads[0].uri).toBe(AD_ASSET)
    })

    it('ad breaks have strongly typed fields (no metadata, no assetListUrl)', async () => {
        await loadAndAwaitAdBreaks()
        const adBreak = suite.player.adBreaks[0]
        expect('metadata' in adBreak).toBeFalse()
        expect('assetListUrl' in adBreak).toBeFalse()
        expect(typeof adBreak.ads).toBe('function')
    })

    it('ad events come from the player-level controller (not per-track)', async () => {
        const player = suite.player
        const spy = jasmine.createSpy('adBreaksChange')
        const sub = player.on('adBreaksChange', spy)
        player.load(...makePlaylist())
        await poll(() => spy.calls.count() > 0, 15_000)
        sub()
        expect(spy).toHaveBeenCalled()
        expect(spy.calls.mostRecent().args[0].current.length).toBe(1)
    })

    // ─── Model transitions ───────────────────────────────────────────────
    it('emits adBreakChange as the playhead crosses into and out of the break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        const entered: string[] = []
        const exited: string[] = []
        const sub = player.on('adBreakChange', (e) => {
            if (e.current) entered.push(e.current.id)
            else if (e.previous) exited.push(e.previous.id)
        })
        try {
            await player.seekTo(MIDROLL_TIME - 1, 0.5)
            await player.play()
            await poll(() => entered.includes(AD_ID) && exited.includes(AD_ID))
            expect(entered).toContain(AD_ID)
            expect(exited).toContain(AD_ID)
        } finally {
            sub()
        }
    })

    it('reports the active ad break while the playhead is inside it', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + MIDROLL_DURATION / 2, 0.5)
        await player.play()
        expect(await poll(() => player.activeAdBreak != null)).toBeTrue()
        expect(player.activeAdBreak?.id).toBe(AD_ID)
    })

    it('skipAd clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.activeAdBreak != null)).toBeTrue()
        player.skipAd()
        expect(player.activeAdBreak).toBeNull()
    })

    it('skipAdBreak clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.activeAdBreak != null)).toBeTrue()
        player.skipAdBreak()
        expect(player.activeAdBreak).toBeNull()
    })

    it('exposes seekRange once the timeline resolves', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        expect(await poll(() => player.seekRange != null, 15_000)).toBeTrue()
        expect(player.seekRange!.start).toBeGreaterThanOrEqual(0)
        expect(player.seekRange!.end).toBeGreaterThan(0)
    })

    // ─── Real ad playback ────────────────────────────────────────────────
    it('plays the ad track over the content and exposes currentAdTrack', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        // The ad track becomes current and begins playing.
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        expect(player.currentAdTrack!.uri).toBe(AD_ASSET)
        // The content track remains the current (suspended) track.
        expect(player.currentTrack).not.toBeNull()
        expect(player.currentTrack!.uri).toBe('integ-interstitial')
    })

    it('resumes content playback after the ad ends', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        // Let the ad finish (or skip after confirming it played a bit).
        expect(
            await poll(() => player.currentTime > MIDROLL_TIME, 40_000)
        ).toBeTrue()
        // Content resumes: the ad track is cleared and playback continues past
        // the break.
        expect(
            await poll(() => player.currentAdTrack == null, 40_000)
        ).toBeTrue()
        expect(player.activeAdBreak).toBeNull()
        expect(
            await poll(() => player.currentTime > MIDROLL_TIME, 20_000)
        ).toBeTrue()
    })

    it('plays a preroll before content, then resumes content', async () => {
        const player = suite.player
        player.load({
            type: 'hls',
            uri: 'integ-preroll',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: 'preroll-1',
                    startTime: 0,
                    duration: 5,
                    assetUri: AD_ASSET,
                    cue: 'PRE',
                },
            ]),
        })
        await poll(() => player.adBreaks.length > 0, 15_000)
        await player.play()
        // Preroll activates at time 0.
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        expect(player.activeAdBreak?.placement).toBe('preroll')
        // Skip it and confirm content resumes and plays.
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()
        expect(
            await poll(() => !player.paused && player.currentTime >= 0, 20_000)
        ).toBeTrue()
    })

    it('plays multiple ads in a break sequentially (X-ASSET-LIST)', async () => {
        const player = suite.player
        player.load({
            type: 'hls',
            uri: 'integ-multi',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: 'multi-1',
                    startTime: MIDROLL_TIME,
                    duration: 12,
                    assetList: [
                        { uri: AD_ASSET, duration: 6 },
                        { uri: AD_ASSET, duration: 6 },
                    ],
                },
            ]),
        })
        await poll(() => player.adBreaks.length > 0, 15_000)
        // Resolve the ad list and confirm two ads.
        const ads = await player.adBreaks[0].ads()
        expect(ads.length).toBe(2)

        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        // Skip the first ad → the second ad begins (break stays active).
        player.skipAd()
        expect(await poll(() => player.activeAdBreak != null)).toBeTrue()
        expect(player.currentAdTrack).not.toBeNull()
        // Skip the last ad → the break ends and content resumes.
        player.skipAd()
        expect(await poll(() => player.activeAdBreak == null)).toBeTrue()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()
    })

    it('disposes the ad track when new content is loaded mid-ad', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()

        // Load different content while the ad is playing.
        player.load({ type: 'hls', uri: CONTENT_ASSET })
        // The ad track is torn down and the ad-break state is reset.
        expect(player.currentAdTrack).toBeNull()
        expect(player.activeAdBreak).toBeNull()
        // New content plays.
        await player.play()
        expect(
            await poll(() => player.currentTrack?.uri === CONTENT_ASSET, 15_000)
        ).toBeTrue()
    })

    // ─── Codec-failure recovery path ─────────────────────────────────────
    // Reproduces the real-world case where an ad uses a codec that differs
    // from the content's. When content resumes after such an ad, a
    // codecUnsupported event triggers reloadCurrentTrack. This must recover
    // and keep playing content without leaving stale ad state behind.
    it('recovers content playback when reloadCurrentTrack fires after an ad', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()

        // Skip the ad → content resumes.
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()

        // Simulate the codec-recovery reload that a mismatched ad codec would
        // trigger on the content track.
        player.reloadCurrentTrack()

        // Content recovers and continues playing; no ad state lingers.
        expect(player.activeAdBreak).toBeNull()
        expect(player.currentAdTrack).toBeNull()
        expect(
            await poll(() => !player.paused && player.currentTime > 0, 30_000)
        ).toBeTrue()
    })

    it('keeps the ad playing across a reloadCurrentTrack during the break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await player.seekTo(MIDROLL_TIME + 1, 0.5)
        await player.play()
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        const adTrack = player.currentAdTrack

        // reloadCurrentTrack rebuilds the CONTENT track. While an ad plays the
        // content track is suspended, so the reload must not disturb the
        // active ad or its break state.
        player.reloadCurrentTrack()
        expect(player.currentAdTrack).toBe(adTrack)
        expect(player.activeAdBreak).not.toBeNull()
    })
})
