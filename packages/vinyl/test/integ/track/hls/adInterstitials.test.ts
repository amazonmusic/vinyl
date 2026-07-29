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

    // Ad switching (seeking into a break, skipping, reloading) intentionally
    // aborts in-flight content seek/append operations, which surface as
    // benign silent AbortErrors. Don't fail the suite on error events; the
    // individual tests assert the observable ad/playback state instead.
    const suite = createVinylSuite({}, { timeout: 180, failOnError: false })

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

    /**
     * Seeks, tolerating the benign AbortError that occurs when the seek lands
     * inside an ad break and the ad immediately takes over the media element.
     */
    async function seekTolerant(time: number): Promise<void> {
        try {
            await suite.player.seekTo(time, 0.5)
        } catch {
            // Seeking into a break aborts the content seek — expected.
        }
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
            await seekTolerant(MIDROLL_TIME - 1)
            await player.play()
            // Enter: the playhead crosses into the break.
            expect(await poll(() => entered.includes(AD_ID))).toBeTrue()
            // Exit: ending the break (the injected ad asset is long, so drive
            // the exit deterministically rather than waiting out playback).
            player.skipAd()
            expect(await poll(() => exited.includes(AD_ID))).toBeTrue()
        } finally {
            sub()
        }
    })

    it('reports the active ad break while the playhead is inside it', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await seekTolerant(MIDROLL_TIME + MIDROLL_DURATION / 2)
        await player.play()
        expect(await poll(() => player.activeAdBreak != null)).toBeTrue()
        expect(player.activeAdBreak?.id).toBe(AD_ID)
    })

    it('skipAd clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play()
        expect(await poll(() => player.activeAdBreak != null)).toBeTrue()
        player.skipAd()
        expect(player.activeAdBreak).toBeNull()
    })

    it('skipAdBreak clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await seekTolerant(MIDROLL_TIME + 1)
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
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play()
        // The ad track becomes current and begins playing.
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        expect(player.currentAdTrack!.uri).toBe(AD_ASSET)
        // The content track remains the current (suspended) track.
        expect(player.currentTrack).not.toBeNull()
        expect(player.currentTrack!.uri).toBe('integ-interstitial')
    })

    it('lets an application attribute ended events to ads vs content', async () => {
        // This is the contract documented in ADS.md: an `ended` observed while
        // activeAdBreak is non-null originated from an ad, not from content.
        const player = suite.player
        // Two ads in the break so the first ad's natural `ended` fires while
        // the break is still active — the exact case that trips naive
        // `ended`-driven queue advancement.
        player.load({
            type: 'hls',
            uri: 'integ-ended-attribution',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: 'multi',
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

        // Record, for every `ended`, whether an ad was active at that moment.
        const endedDuringAd: boolean[] = []
        const sub = player.on('ended', () => {
            endedDuringAd.push(player.activeAdBreak != null)
        })
        try {
            await seekTolerant(MIDROLL_TIME + 1)
            await player.play()
            expect(await poll(() => player.currentAdTrack != null)).toBeTrue()

            // Advance through both ads; each advance stands in for the ad's
            // own `ended`, and the break stays active between ads.
            expect(player.activeAdBreak).not.toBeNull()
            player.skipAd() // -> second ad
            expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
            expect(player.activeAdBreak).not.toBeNull()
            player.skipAd() // -> break ends, content resumes
            expect(await poll(() => player.activeAdBreak == null)).toBeTrue()

            // Every `ended` that fired during the sequence was attributable to
            // an ad (activeAdBreak was non-null); none was misread as content.
            expect(endedDuringAd.every((wasAd) => wasAd)).toBeTrue()
        } finally {
            sub()
        }
    })

    it('resumes content playback after the ad break ends', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play()
        // Ad is playing over the suspended content.
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        // Confirm the ad actually plays (its playhead advances).
        expect(await poll(() => player.currentTime > 0, 20_000)).toBeTrue()
        // End the break; content resumes at the saved position and plays on.
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()
        expect(player.activeAdBreak).toBeNull()
        expect(
            await poll(
                () => !player.paused && player.currentTrack != null,
                20_000
            )
        ).toBeTrue()
        expect(player.currentTrack!.uri).toBe('integ-interstitial')
    })

    it('resumes content playback when the ad ends naturally', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play()
        // Ad is playing over the suspended content.
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        expect(await poll(() => player.currentTime > 0, 20_000)).toBeTrue()

        // Drive the ad to its natural end by seeking near the end of the ad
        // asset (the playhead is the ad's while it plays), rather than calling
        // skipAd. The ad's own `ended` must resume content playback.
        const adDuration = player.duration
        await player
            .seekTo(Math.max(0, adDuration - 1), 1)
            .catch(() => undefined)

        // Content resumes and is playing (not left paused by the ad's end).
        expect(
            await poll(() => player.currentAdTrack == null, 40_000)
        ).toBeTrue()
        expect(player.activeAdBreak).toBeNull()
        expect(player.currentTrack!.uri).toBe('integ-interstitial')
        expect(
            await poll(() => !player.paused && player.currentTime > 0, 20_000)
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

        await seekTolerant(MIDROLL_TIME + 1)
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
        await seekTolerant(MIDROLL_TIME + 1)
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

    // ─── Ad id collisions across tracks ──────────────────────────────────
    // Break/ad ids are only unique within a single presentation, so two
    // different tracks can carry the same interstitial ID. Ad state must not
    // leak across a content change, or the second track's ad would be
    // suppressed (treated as already-played) — a regression these tests guard.

    it('plays a reused-id ad after loading a different track (via load)', async () => {
        const player = suite.player
        // Track A carries interstitial ID "1"; play and skip it.
        player.load({
            type: 'hls',
            uri: 'track-a',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: '1',
                    startTime: MIDROLL_TIME,
                    duration: 6,
                    assetUri: AD_ASSET,
                },
            ]),
        })
        await poll(() => player.adBreaks.length > 0, 15_000)
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play().catch(() => undefined)
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()

        // Load Track B which reuses interstitial ID "1". Its ad must still play
        // (the skip from Track A must not carry over).
        player.load({
            type: 'hls',
            uri: 'track-b',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: '1',
                    startTime: MIDROLL_TIME,
                    duration: 6,
                    assetUri: AD_ASSET,
                },
            ]),
        })
        expect(await poll(() => player.adBreaks.length > 0, 15_000)).toBeTrue()
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play().catch(() => undefined)
        expect(
            await poll(() => player.currentAdTrack != null, 30_000)
        ).toBeTrue()
        expect(player.activeAdBreak?.id).toBe('1')
    })

    it('plays a reused-id ad after advancing the queue (via next)', async () => {
        const player = suite.player
        // A two-track queue where both tracks carry interstitial ID "1".
        player.load(
            {
                type: 'hls',
                uri: 'queue-a',
                manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                    {
                        id: '1',
                        startTime: MIDROLL_TIME,
                        duration: 6,
                        assetUri: AD_ASSET,
                    },
                ]),
            },
            {
                type: 'hls',
                uri: 'queue-b',
                manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                    {
                        id: '1',
                        startTime: MIDROLL_TIME,
                        duration: 6,
                        assetUri: AD_ASSET,
                    },
                ]),
            }
        )
        await poll(() => player.adBreaks.length > 0, 15_000)
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play().catch(() => undefined)
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()

        // Advance to the next queued track (same reused ad ID "1").
        player.next()
        expect(
            await poll(() => player.currentTrack?.uri === 'queue-b', 15_000)
        ).toBeTrue()
        // queue-b's break is rediscovered. Its shared id must NOT be
        // pre-suppressed by queue-a's skip (the collision regression).
        expect(await poll(() => player.adBreaks.length > 0, 15_000)).toBeTrue()
        expect(player.activeAdBreak).toBeNull()
        // Crossing into the break activates it, proving the id was not treated
        // as already-skipped.
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play().catch(() => undefined)
        expect(
            await poll(() => player.activeAdBreak != null, 30_000)
        ).toBeTrue()
        expect(player.activeAdBreak?.id).toBe('1')
    })

    // ─── Codec-failure recovery path ─────────────────────────────────────
    // Reproduces the real-world case where an ad uses a codec that differs
    // from the content's. When content resumes after such an ad, a
    // codecUnsupported event triggers reloadCurrentTrack. This must recover
    // and keep playing content without leaving stale ad state behind.
    it('recovers content playback when reloadCurrentTrack fires after an ad', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await seekTolerant(MIDROLL_TIME + 1)
        await player.play()
        expect(await poll(() => player.currentAdTrack != null)).toBeTrue()

        // Skip the ad → content resumes and begins playing.
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()
        expect(
            await poll(() => !player.paused && player.currentTime > 0, 20_000)
        ).toBeTrue()

        // Simulate the codec-recovery reload that a mismatched ad codec would
        // trigger on the content track once it has resumed.
        player.reloadCurrentTrack()

        // Content recovers and continues playing; no ad state lingers.
        expect(player.activeAdBreak).toBeNull()
        expect(player.currentAdTrack).toBeNull()
        expect(
            await poll(() => !player.paused && player.currentTime > 0, 30_000)
        ).toBeTrue()
    })

    // Note: the invariant that reloadCurrentTrack during an ad rebuilds the
    // suspended content in place without disturbing the ad is verified
    // deterministically in the TrackController unit tests, where ad playback
    // timing is controlled. A real-browser version would race the ad's own
    // playback lifecycle, so it is intentionally not duplicated here.
})

/**
 * Real third-party stream (art19 / AWS MediaTailor) whose interstitial ad
 * manifests rely on EXT-X-DEFINE variable substitution, including `QUERYPARAM`
 * tokens carried on the ad manifest URL. This is the end-to-end guard that ad
 * URIs are fully resolved (no `{$…}` tokens leak) and that the ad plays.
 *
 * It hits the public internet, so it tolerates network flake: it pends rather
 * than fails when the stream or its ads are unreachable.
 */
describe('hls ad interstitials integ (art19 real stream)', () => {
    const STREAM = vinylTestAssets.hls.art19InterstitialsVod

    const suite = createVinylSuite({}, { timeout: 180, failOnError: false })

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

    it('discovers pre/mid/post-roll breaks with fully substituted ad URIs', async () => {
        const player = suite.player
        player.load({ type: 'hls', uri: STREAM })
        if (!(await poll(() => player.adBreaks.length > 0, 20_000))) {
            pending('art19 stream unreachable')
            return
        }
        const placements = player.adBreaks.map((b) => b.placement)
        expect(placements).toContain('preroll')
        expect(placements).toContain('postroll')

        // Every break's resolved ad URIs must be fully substituted — no
        // leftover EXT-X-DEFINE tokens.
        for (const adBreak of player.adBreaks) {
            const ads = await adBreak.ads()
            for (const ad of ads) {
                expect(ad.uri).withContext(adBreak.id).not.toContain('{$')
                expect(ad.uri)
                    .withContext(adBreak.id)
                    .toMatch(/^https?:\/\//)
            }
        }
    })

    it('plays the preroll ad, then resumes content', async () => {
        const player = suite.player
        player.load({ type: 'hls', uri: STREAM })
        if (!(await poll(() => player.adBreaks.length > 0, 20_000))) {
            pending('art19 stream unreachable')
            return
        }
        // The preroll activates at time 0, suspending content — this can abort
        // the initial play() as the ad takes over the element. That's expected.
        await player.play().catch(() => undefined)
        // The preroll is at time 0; its ad track should activate and advance.
        if (!(await poll(() => player.currentAdTrack != null, 30_000))) {
            pending('art19 ad did not start (network/CDN)')
            return
        }
        // The ad genuinely plays (its playhead advances past 0).
        expect(await poll(() => player.currentTime > 0, 20_000)).toBeTrue()
        // Skipping the break resumes content (long real ads are impractical to
        // play through in a test).
        player.skipAd()
        expect(await poll(() => player.currentAdTrack == null)).toBeTrue()
    })
})
