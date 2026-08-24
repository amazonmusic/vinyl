/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylSuite,
    mediaRef,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'
import {
    type HlsManifestData,
    PlaybackReadyState,
    supportsMse,
    type VinylTrackLoadOptions,
} from '@amazon/vinyl'
import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import {
    nextEventAsPromise,
    noop,
    poll,
    resolveUrl,
    resolveValueProvider,
} from '@amazon/vinyl-util'

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
    /** The raw CUE token list, e.g. 'PRE', 'ONCE', 'POST,ONCE'. */
    readonly cue?: string
    /** X-RESUME-OFFSET in seconds (signed). */
    readonly resumeOffset?: number
    /** X-PLAYOUT-LIMIT in seconds. */
    readonly playoutLimit?: number
    /** X-ASSET-LIST SKIP-CONTROL window (requires `assetList`). */
    readonly skipControl?: { offset: number; duration?: number }
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
        const cache = new Map<string, ReturnType<typeof parseMediaPlaylist>>()
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
                ...(it.skipControl && {
                    'SKIP-CONTROL': {
                        OFFSET: it.skipControl.offset,
                        ...(it.skipControl.duration != null && {
                            DURATION: it.skipControl.duration,
                        }),
                    },
                }),
            })
            const dataUrl = 'data:application/json;base64,' + btoa(json)
            asset = `X-ASSET-LIST="${dataUrl}"`
        } else {
            asset = `X-ASSET-URI="${it.assetUri}"`
        }
        const cue = it.cue ? `,CUE="${it.cue}"` : ''
        const resumeOffset =
            it.resumeOffset == null ? '' : `,X-RESUME-OFFSET=${it.resumeOffset}`
        const playoutLimit =
            it.playoutLimit == null ? '' : `,X-PLAYOUT-LIMIT=${it.playoutLimit}`
        return (
            `#EXT-X-DATERANGE:ID="${it.id}",` +
            `CLASS="com.apple.hls.interstitial",` +
            `START-DATE="${startDate}",DURATION=${it.duration},` +
            `${asset}${cue}${resumeOffset}${playoutLimit}`
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

describe('hls ad interstitials integ', () => {
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

    /**
     * Starts playback, then seeks into the given position. Playing before
     * seeking is required on iOS Safari: seeking a cold, never-played MSE
     * element hangs (the seek never completes, and a subsequent play() from the
     * now-unbuffered position stalls in `waiting` until it times out). Warming
     * the element with play() first mirrors real usage (the playhead advances
     * into a break during playback) and avoids the stall.
     */
    async function playThenSeek(time: number): Promise<void> {
        await suite.player.play().catch(() => undefined)
        await seekTolerant(time)
    }

    async function loadAndAwaitAdBreaks(
        playlist: VinylTrackLoadOptions[] = makePlaylist()
    ): Promise<void> {
        suite.player.load(...playlist)
        await poll(
            () => (suite.player.currentTrackAds?.adBreaks.length ?? 0) > 0,
            { timeout: 15 }
        )
    }

    // ─── Discovery ───────────────────────────────────────────────────────
    it('discovers the injected interstitial as an ad break', async () => {
        await loadAndAwaitAdBreaks()
        const breaks = suite.player.currentTrackAds!.adBreaks
        expect(breaks.length).toBe(1)
        expect(breaks[0].id).toBe(AD_ID)
        expect(breaks[0].startTime).toBeCloseTo(MIDROLL_TIME, 1)
        expect(breaks[0].duration).toBe(MIDROLL_DURATION)
        expect(breaks[0].placement).toBe('midroll')
        const ads = await resolveValueProvider(breaks[0].ads)
        expect(ads[0].uri).toBe(AD_ASSET)
    })

    it('ad breaks have strongly typed fields (no metadata, no assetListUrl)', async () => {
        await loadAndAwaitAdBreaks()
        const adBreak = suite.player.currentTrackAds!.adBreaks[0]
        expect('metadata' in adBreak).toBeFalse()
        expect('assetListUrl' in adBreak).toBeFalse()
        expect(typeof adBreak.ads).toBe('function')
    })

    it('ad events come from the player-level controller (not per-track)', async () => {
        const player = suite.player
        const spy = jasmine.createSpy('currentTrackAdsChange')
        const sub = player.on('currentTrackAdsChange', spy)
        player.load(...makePlaylist())
        // TrackController fires currentTrackAdsChange with `current: null` as
        // soon as the track's ads are `null` (still loading), and again when
        // discovery resolves. Wait for the resolved event, not the initial one.
        await poll(
            () =>
                spy.calls.count() > 0 &&
                spy.calls.mostRecent().args[0].current != null,
            { timeout: 15 }
        )
        sub()
        expect(spy.calls.mostRecent().args[0].current.adBreaks.length).toBe(1)
    })

    // ─── Model transitions ───────────────────────────────────────────────
    it('emits adBreakEntered/adBreakCompleted as the playhead crosses into and out of the break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        const entered: string[] = []
        const exited: string[] = []
        const enteredSub = player.on('adBreakEntered', (e) =>
            entered.push(e.adBreak.id)
        )
        const exitedSub = player.on('adBreakCompleted', (e) =>
            exited.push(e.adBreak.id)
        )
        try {
            await playThenSeek(MIDROLL_TIME - 1)
            // Enter: the playhead crosses into the break.
            expect(await poll(() => entered.includes(AD_ID), { timeout: 30 }))
                .withContext('entered.includes(AD_ID)')
                .toBeTrue()
            // Exit: ending the break (the injected ad asset is long, so drive
            // the exit deterministically rather than waiting out playback).
            player.skipAd()
            expect(await poll(() => exited.includes(AD_ID), { timeout: 30 }))
                .withContext('exited.includes(AD_ID)')
                .toBeTrue()
        } finally {
            enteredSub()
            exitedSub()
        }
    })

    it('reports the active ad break while the playhead is inside it', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + MIDROLL_DURATION / 2)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('player.currentAdBreak != null')
            .toBeTrue()
        expect(player.currentAdBreak?.id).toBe(AD_ID)
    })

    it('skipAd clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('player.currentAdBreak != null')
            .toBeTrue()
        player.skipAd()
        expect(player.currentAdBreak).toBeNull()
    })

    it('skipAdBreak clears the active ad break', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('player.currentAdBreak != null')
            .toBeTrue()
        player.skipAdBreak()
        expect(player.currentAdBreak).toBeNull()
    })

    it('exposes seekRange once the timeline resolves', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        expect(await poll(() => player.seekRange != null, { timeout: 15 }))
            .withContext('player.seekRange != null')
            .toBeTrue()
        expect(player.seekRange!.start).toBeGreaterThanOrEqual(0)
        expect(player.seekRange!.end).toBeGreaterThan(0)
    })

    // ─── Real ad playback ────────────────────────────────────────────────
    it('plays the ad track as the current track over the content', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        // The ad track becomes the current track and begins playing (the ad
        // track replaces content as `currentTrack` while the break is active;
        // the suspended content is restored when the break ends).
        expect(
            await poll(() => player.currentTrack?.uri === AD_ASSET, {
                timeout: 30,
            })
        )
            .withContext('player.currentTrack?.uri === AD_ASSET')
            .toBeTrue()
        expect(player.currentTrack!.uri).toBe(AD_ASSET)
        // The ad plays within the active break over the (suspended) content.
        expect(player.currentAd).not.toBeNull()
        expect(player.currentAdBreak?.id).toBe(AD_ID)
    })

    it('lets an application attribute ended events to ads vs content', async () => {
        // This is the contract documented in ADS.md: an `ended` observed while
        // currentAdBreak is non-null originated from an ad, not from content.
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
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })

        // Record, for every `ended`, whether an ad was active at that moment.
        const endedDuringAd: boolean[] = []
        const sub = player.on('ended', () => {
            endedDuringAd.push(player.currentAdBreak != null)
        })
        try {
            await playThenSeek(MIDROLL_TIME + 1)
            expect(await poll(() => player.currentAd != null, { timeout: 30 }))
                .withContext('player.currentAd != null')
                .toBeTrue()

            // Advance through both ads; each advance stands in for the ad's
            // own `ended`, and the break stays active between ads.
            expect(player.currentAdBreak).not.toBeNull()
            player.skipAd() // -> second ad
            expect(await poll(() => player.currentAd != null, { timeout: 30 }))
                .withContext('player.currentAd != null')
                .toBeTrue()
            expect(player.currentAdBreak).not.toBeNull()
            player.skipAd() // -> break ends, content resumes
            expect(
                await poll(() => player.currentAdBreak == null, { timeout: 30 })
            )
                .withContext('player.currentAdBreak == null')
                .toBeTrue()

            // Every `ended` that fired during the sequence was attributable to
            // an ad (currentAdBreak was non-null); none was misread as content.
            expect(endedDuringAd.every((wasAd) => wasAd)).toBeTrue()
        } finally {
            sub()
        }
    })

    it('resumes content playback after the ad break ends', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        // Ad is playing over the suspended content.
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        // Confirm the ad actually plays (its playhead advances).
        expect(await poll(() => player.currentTime > 0, { timeout: 20 }))
            .withContext('player.currentTime > 0')
            .toBeTrue()
        // End the break; content resumes at the saved position and plays on.
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()
        expect(player.currentAdBreak).toBeNull()
        // The content resume is deferred a frame (TrackController delays the
        // queue change past adCompleted), so wait for the content track to
        // become current again and play, rather than asserting synchronously.
        expect(
            await poll(
                () =>
                    player.currentTrack?.uri === 'integ-interstitial' &&
                    !player.paused,
                { timeout: 20 }
            )
        )
            .withContext('content track resumed and playing')
            .toBeTrue()
    })

    it('resumes content playback when the ad ends naturally', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        // Ad is playing over the suspended content.
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        expect(await poll(() => player.currentTime > 0, { timeout: 20 }))
            .withContext('player.currentTime > 0')
            .toBeTrue()

        // Drive the ad to its natural end by seeking near the end of the ad
        // asset (the playhead is the ad's while it plays), rather than calling
        // skipAd. The ad's own `ended` must resume content playback.
        const adDuration = player.duration
        await player
            .seekTo(Math.max(0, adDuration - 1), 1)
            .catch(() => undefined)

        // Content resumes and is playing (not left paused by the ad's end).
        expect(await poll(() => player.currentAd == null, { timeout: 40 }))
            .withContext('player.currentAd == null')
            .toBeTrue()
        expect(player.currentAdBreak).toBeNull()
        // The content resume is deferred a frame past adCompleted, so wait for
        // the content track to become current again and play.
        expect(
            await poll(
                () =>
                    player.currentTrack?.uri === 'integ-interstitial' &&
                    !player.paused &&
                    player.currentTime > 0,
                { timeout: 20 }
            )
        )
            .withContext('content track resumed and playing')
            .toBeTrue()
    })

    // ─── CUE hints and X-RESUME-OFFSET ───────────────────────────────────
    /** Loads the standard single-midroll playlist, with per-break overrides. */
    async function loadMidroll(
        extra: Partial<Interstitial> = {}
    ): Promise<void> {
        suite.player.load({
            type: 'hls',
            uri: 'integ-interstitial',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: AD_ID,
                    startTime: MIDROLL_TIME,
                    duration: MIDROLL_DURATION,
                    assetUri: AD_ASSET,
                    ...extra,
                },
            ]),
        })
        await poll(
            () => (suite.player.currentTrackAds?.adBreaks.length ?? 0) > 0,
            { timeout: 15 }
        )
    }

    it('resumes content at the X-RESUME-OFFSET position after a midroll', async () => {
        const player = suite.player
        await loadMidroll({ resumeOffset: 10 })
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('ad playing')
            .toBeTrue()
        expect(await poll(() => player.currentTime > 0, { timeout: 20 }))
            .withContext('ad advanced')
            .toBeTrue()
        player.skipAd()
        // Content resumes at start (20) + offset (10) = 30, skipping content,
        // rather than resuming in place at the break start.
        expect(
            await poll(
                () =>
                    player.currentTrack?.uri === 'integ-interstitial' &&
                    !player.paused &&
                    player.currentTime >= MIDROLL_TIME + 10 - 1,
                { timeout: 20 }
            )
        )
            .withContext('content resumed at ~start+offset')
            .toBeTrue()
    })

    it('replays a non-ONCE midroll after seeking back across it', async () => {
        const player = suite.player
        await loadMidroll() // no CUE → replayable
        // First crossing: enter the break, then skip back to content.
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('entered on the first crossing')
            .toBeTrue()
        player.skipAd()
        expect(
            await poll(
                () =>
                    player.currentAdBreak == null &&
                    player.currentTrack?.uri === 'integ-interstitial',
                { timeout: 20 }
            )
        )
            .withContext('content resumed')
            .toBeTrue()
        // Seek back before the break to re-arm it, then play forward across it.
        await seekTolerant(MIDROLL_TIME - 5)
        await player.play().catch(() => undefined)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('non-ONCE break re-entered on the second crossing')
            .toBeTrue()
    })

    it('does not replay a CUE=ONCE midroll after seeking back across it', async () => {
        const player = suite.player
        await loadMidroll({ cue: 'ONCE' })
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('entered on the first crossing')
            .toBeTrue()
        player.skipAd()
        expect(
            await poll(
                () =>
                    player.currentAdBreak == null &&
                    player.currentTrack?.uri === 'integ-interstitial',
                { timeout: 20 }
            )
        )
            .withContext('content resumed')
            .toBeTrue()
        // Seek back before the ONCE break and play forward across its start; it
        // must NOT re-enter. If it (incorrectly) did, currentAdBreak would go
        // non-null and the playhead would stall below the break start, timing
        // this poll out.
        const reentered: string[] = []
        const sub = player.on('adBreakEntered', (e) =>
            reentered.push(e.adBreak.id)
        )
        try {
            await seekTolerant(MIDROLL_TIME - 5)
            await player.play().catch(() => undefined)
            expect(
                await poll(
                    () =>
                        player.currentAdBreak == null &&
                        player.currentTrack?.uri === 'integ-interstitial' &&
                        player.currentTime >= MIDROLL_TIME + 1,
                    { timeout: 30 }
                )
            )
                .withContext('crossed the ONCE break start without re-entering')
                .toBeTrue()
            expect(reentered).toEqual([])
        } finally {
            sub()
        }
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
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })
        await player.play()
        // Preroll activates at time 0.
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        expect(player.currentAdBreak?.placement).toBe('preroll')
        // Skip it and confirm content resumes and plays.
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()
        expect(
            await poll(() => !player.paused && player.currentTime >= 0, {
                timeout: 20,
            })
        ).toBeTrue()
    })

    // ─── Natural playback ordering ───────────────────────────────────────
    // Playing from the start (no seeking) enters breaks in timeline order.
    it('activates a midroll during natural forward playback (no seek)', async () => {
        const player = suite.player
        // Midroll early enough to reach by playing from the start.
        player.load({
            type: 'hls',
            uri: 'integ-natural-mid',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: 'mid',
                    startTime: 3,
                    duration: MIDROLL_DURATION,
                    assetUri: AD_ASSET,
                },
            ]),
        })
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })
        // Play from the start and let the playhead cross the break naturally —
        // no seek. The midroll must activate on the forward crossing.
        await player.play().catch(noop)
        expect(
            await poll(() => player.currentAdBreak?.id === 'mid', {
                timeout: 40,
            })
        )
            .withContext('midroll activated on natural crossing')
            .toBeTrue()
        expect(player.currentAdBreak?.placement).toBe('midroll')
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
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })
        // Resolve the ad list and confirm two ads.
        const ads = await resolveValueProvider(
            player.currentTrackAds!.adBreaks[0].ads
        )
        expect(ads.length).toBe(2)

        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        // Skip the first ad → the second ad begins (break stays active).
        player.skipAd()
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('player.currentAdBreak != null')
            .toBeTrue()
        expect(player.currentAd).not.toBeNull()
        // Skip the last ad → the break ends and content resumes.
        player.skipAd()
        expect(await poll(() => player.currentAdBreak == null, { timeout: 30 }))
            .withContext('player.currentAdBreak == null')
            .toBeTrue()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()
    })

    it('surfaces the X-ASSET-LIST skip window on the ad break', async () => {
        const player = suite.player
        player.load({
            type: 'hls',
            uri: 'integ-skip',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: 'skip-1',
                    startTime: MIDROLL_TIME,
                    duration: MIDROLL_DURATION,
                    assetList: [{ uri: AD_ASSET, duration: 6 }],
                    skipControl: { offset: 3, duration: 5 },
                },
            ]),
        })
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })
        const skip = await resolveValueProvider(
            player.currentTrackAds!.adBreaks[0].skipControl
        )
        expect(skip).toEqual({ offset: 3, duration: 5 })
    })

    it('parks content loaded and paused after a postroll finishes (no stuck loading)', async () => {
        const player = suite.player
        player.load({
            type: 'hls',
            uri: 'integ-postroll',
            manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                {
                    id: 'postroll-1',
                    startTime: 0,
                    duration: 6,
                    assetUri: AD_ASSET,
                    cue: 'POST',
                },
            ]),
        })
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })
        // Tolerate the benign AbortError when the seek below pauses the element
        // before this play() promise settles (more likely under throttling).
        await player.play().catch(noop)
        // A CUE="POST" range anchors at media time 0, so its resolved start
        // time falls within content. The postroll must NOT activate while
        // content is still playing — it is entered only once content ends.
        expect(player.currentAdBreak)
            .withContext('postroll not active during content')
            .toBeNull()
        // Drive content to its end so the postroll triggers on `ended`.
        const contentDuration = player.duration
        await player
            .seekTo(Math.max(0, contentDuration - 1.5), 1)
            .catch(() => undefined)
        // The postroll takes over and plays.
        expect(await poll(() => player.currentAd != null, { timeout: 40 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        expect(player.currentAdBreak?.placement).toBe('postroll')
        await poll(() => !player.paused, { timeout: 8 })

        // Skip the postroll while it is actively playing.
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 20 }))
            .withContext('player.currentAd == null')
            .toBeTrue()

        // Content is loaded (not stuck loading), parked near the start; the
        // app-observable paused state (paused || ended) is true — no replay.
        // The resume is deferred a frame past adCompleted, so poll for it.
        expect(
            await poll(() => player.currentTrack?.uri === 'integ-postroll', {
                timeout: 20,
            })
        )
            .withContext('content track resumed after postroll')
            .toBeTrue()
        expect(
            await poll(
                () => player.readyState !== PlaybackReadyState.HAVE_NOTHING,
                { timeout: 20 }
            )
        )
            .withContext(
                'player.readyState !== PlaybackReadyState.HAVE_NOTHING'
            )
            .toBeTrue()
        expect(await poll(() => player.paused || player.ended, { timeout: 20 }))
            .withContext('player.paused || player.ended')
            .toBeTrue()
    })

    it('does not replay a postroll after it finishes naturally', async () => {
        const player = suite.player
        // A postroll that is never suppressed re-enters on each content
        // `ended`, looping forever. Record every entry to catch a replay.
        const postrollEntries: string[] = []
        const sub = player.on('adBreakEntered', (e) => {
            if (e.adBreak.placement === 'postroll') {
                postrollEntries.push(e.adBreak.id)
            }
        })
        try {
            player.load({
                type: 'hls',
                uri: 'integ-postroll-replay',
                manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                    {
                        id: 'postroll-1',
                        startTime: 0,
                        duration: 4,
                        // Short ad so the break ends quickly on its own.
                        assetList: [{ uri: AD_ASSET, duration: 3 }],
                        cue: 'POST',
                    },
                ]),
            })
            await poll(
                () => (player.currentTrackAds?.adBreaks.length ?? 0) > 0,
                { timeout: 15 }
            )
            await player.play().catch(noop)
            // Drive content to its end so the postroll triggers on `ended`.
            const contentDuration = player.duration
            await player
                .seekTo(Math.max(0, contentDuration - 1.5), 1)
                .catch(() => undefined)
            // The postroll takes over and plays.
            expect(await poll(() => player.currentAd != null, { timeout: 40 }))
                .withContext('postroll ad started')
                .toBeTrue()
            expect(player.currentAdBreak?.placement).toBe('postroll')
            // Let the postroll finish on its own, rather than skipping it.
            expect(await poll(() => player.currentAd == null, { timeout: 40 }))
                .withContext('postroll ad finished')
                .toBeTrue()
            // Content resumes on the content track after the break.
            expect(
                await poll(
                    () => player.currentTrack?.uri === 'integ-postroll-replay',
                    { timeout: 20 }
                )
            )
                .withContext('content resumed after postroll')
                .toBeTrue()

            // Re-drive content to its end to fire `ended` again — the event
            // that re-invokes enterPostroll. It must not re-enter the postroll.
            await player
                .seekTo(Math.max(0, player.duration - 1.5), 1)
                .catch(() => undefined)
            await player.play().catch(noop)
            const replayed = await poll(() => postrollEntries.length > 1, {
                timeout: 20,
            })
            expect(replayed).withContext('postroll replayed').toBeFalse()
            expect(player.currentAdBreak).toBeNull()
            expect(postrollEntries).toEqual(['postroll-1'])
        } finally {
            sub()
        }
    })

    it('disposes the ad track when new content is loaded mid-ad', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()

        // Load different content while the ad is playing.
        player.load({ type: 'hls', uri: CONTENT_ASSET })
        // The ad track is torn down and the ad-break state is reset.
        expect(player.currentAd).toBeNull()
        expect(player.currentAdBreak).toBeNull()
        // New content plays.
        await player.play()
        expect(
            await poll(() => player.currentTrack?.uri === CONTENT_ASSET, {
                timeout: 15,
            })
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
        await nextEventAsPromise(player, 'currentTrackAdsChange', {
            timeout: 15,
        })
        expect(player.currentTrackAds?.adBreaks.length ?? 0)
            .withContext('adBreaks length')
            .toBeGreaterThan(0)
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()

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
        expect(
            await poll(
                () => (player.currentTrackAds?.adBreaks.length ?? 0) > 0,
                { timeout: 15 }
            )
        )
            .withContext('(player.currentTrackAds?.adBreaks.length ?? 0) > 0')
            .toBeTrue()
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        expect(player.currentAdBreak?.id).toBe('1')
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
        await poll(() => (player.currentTrackAds?.adBreaks.length ?? 0) > 0, {
            timeout: 15,
        })
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()

        // Advance to the next queued track (same reused ad ID "1").
        player.next()
        expect(
            await poll(() => player.currentTrack?.uri === 'queue-b', {
                timeout: 15,
            })
        ).toBeTrue()
        // queue-b's break is rediscovered. Its shared id must NOT be
        // pre-suppressed by queue-a's skip (the collision regression).
        expect(
            await poll(
                () => (player.currentTrackAds?.adBreaks.length ?? 0) > 0,
                { timeout: 15 }
            )
        )
            .withContext('(player.currentTrackAds?.adBreaks.length ?? 0) > 0')
            .toBeTrue()
        expect(player.currentAdBreak).toBeNull()
        // Crossing into the break activates it, proving the id was not treated
        // as already-skipped.
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAdBreak != null, { timeout: 30 }))
            .withContext('player.currentAdBreak != null')
            .toBeTrue()
        expect(player.currentAdBreak?.id).toBe('1')
    })

    // ─── Codec-failure recovery path ─────────────────────────────────────
    // Reproduces the real-world case where an ad uses a codec that differs
    // from the content's. When content resumes after such an ad, a
    // codecUnsupported event triggers a hard reset. This must recover and keep
    // playing content without leaving stale ad state behind.
    it('recovers content playback when a hard reset fires after an ad', async () => {
        await loadAndAwaitAdBreaks()
        const player = suite.player
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()

        // Skip the ad → content resumes and begins playing.
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()
        expect(
            await poll(() => !player.paused && player.currentTime > 0, {
                timeout: 20,
            })
        ).toBeTrue()

        // Simulate the codec-recovery reload that a mismatched ad codec would
        // trigger on the content track once it has resumed.
        player.reset(/* hard */ true)

        // Content recovers and continues playing; no ad state lingers.
        expect(player.currentAdBreak).toBeNull()
        expect(player.currentAd).toBeNull()
        expect(
            await poll(() => !player.paused && player.currentTime > 0, {
                timeout: 30,
            })
        ).toBeTrue()
    })

    // Note: the invariant that a hard reset during an ad rebuilds the
    // suspended content in place without disturbing the ad is verified
    // deterministically in the TrackController unit tests, where ad playback
    // timing is controlled. A real-browser version would race the ad's own
    // playback lifecycle, so it is intentionally not duplicated here.

    // Regression: a caption cue could get stuck on screen after an ad swapped
    // the track — the content's DOM text track was orphaned by the source
    // reset on suspend but its cues kept showing. Suspending on deactivate and
    // rebuilding on reactivation must leave exactly one showing track.
    it('does not leave a stuck caption track after an ad', async () => {
        const player = suite.player
        await loadAndAwaitAdBreaks()
        // Activate a caption and wait for cues to render on the DOM track.
        await poll(() => player.textTracks.length > 0, { timeout: 15 })
        const track = player.textTracks[0]
        player.setActiveTextTrack(track.id)
        const showingWithCues = () => {
            const dom = mediaRef.value.textTracks
            return Array.from({ length: dom.length }, (_, i) => dom[i]).filter(
                (t) => t.mode === 'showing' && (t.cues?.length ?? 0) > 0
            )
        }
        expect(await poll(() => showingWithCues().length > 0, { timeout: 15 }))
            .withContext('showingWithCues().length > 0')
            .toBeTrue()

        // Play into the midroll ad and back out.
        await playThenSeek(MIDROLL_TIME + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('player.currentAd != null')
            .toBeTrue()
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()

        // After resume the caption renders again on exactly one showing track —
        // no orphaned track left showing a stuck cue.
        expect(await poll(() => showingWithCues().length > 0, { timeout: 20 }))
            .withContext('showingWithCues().length > 0')
            .toBeTrue()
        expect(showingWithCues().length).toBe(1)
    })
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

    it('discovers pre/mid/post-roll breaks with fully substituted ad URIs', async () => {
        const player = suite.player
        player.load({ type: 'hls', uri: STREAM })
        expect(
            await poll(
                () => (player.currentTrackAds?.adBreaks.length ?? 0) > 0,
                { timeout: 20 }
            )
        )
            .withContext('art19 ad breaks loaded')
            .toBeTrue()
        const placements = player.currentTrackAds!.adBreaks.map(
            (b) => b.placement
        )
        expect(placements).toContain('preroll')
        expect(placements).toContain('postroll')

        // Every break's resolved ad URIs must be fully substituted — no
        // leftover EXT-X-DEFINE tokens.
        for (const adBreak of player.currentTrackAds?.adBreaks ?? []) {
            const ads = await resolveValueProvider(adBreak.ads)
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
        expect(
            await poll(
                () => (player.currentTrackAds?.adBreaks.length ?? 0) > 0,
                { timeout: 20 }
            )
        )
            .withContext('art19 ad breaks loaded')
            .toBeTrue()
        // The preroll at time 0 takes over the element, which can abort play().
        await player.play().catch(() => undefined)
        expect(await poll(() => player.currentAd != null, { timeout: 30 }))
            .withContext('preroll ad started')
            .toBeTrue()
        expect(await poll(() => player.currentTime > 0, { timeout: 20 }))
            .withContext('preroll ad advanced')
            .toBeTrue()
        // Skip rather than play a long real ad to completion.
        player.skipAd()
        expect(await poll(() => player.currentAd == null, { timeout: 30 }))
            .withContext('player.currentAd == null')
            .toBeTrue()
    })

    it('resumes content, not another break, after the preroll ends (natural)', async () => {
        const player = suite.player
        const enteredPlacements: string[] = []
        const sub = player.on('adBreakEntered', (e) =>
            enteredPlacements.push(e.adBreak.placement)
        )
        try {
            player.load({ type: 'hls', uri: STREAM })
            await nextEventAsPromise(player, 'currentTrackAdsChange', {
                filter: (e) => (e.current?.adBreaks.length ?? 0) > 0,
                timeout: 20,
            })
            const placements = player.currentTrackAds!.adBreaks.map(
                (b) => b.placement
            )
            expect(placements).toContain('preroll')
            expect(placements).toContain('midroll')
            expect(placements).toContain('postroll')

            await player.play().catch(() => undefined)
            // Bail on a 2nd break so a midroll tripped off the preroll's ad time
            // fails the assertion rather than being waited out; the [0] guard
            // defers the resume check until the preroll has begun.
            await poll(
                () =>
                    enteredPlacements[0] === 'preroll' &&
                    ((player.currentAd == null &&
                        player.currentTrack?.uri === STREAM) ||
                        enteredPlacements.length > 1),
                { timeout: 120 }
            )
            expect(enteredPlacements)
                .withContext('the preroll ad time must not trip a later break')
                .toEqual(['preroll'])
        } finally {
            sub()
        }
    })
})

describe('hls ad interstitials integ (ad failure recovery)', () => {
    // Short ad-load timeout so an unreachable ad fails fast.
    const suite = createVinylSuite(
        { adController: { adLoadTimeout: 3 } },
        { timeout: 60, failOnError: false }
    )

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    it('recovers to content when a preroll ad never loads', async () => {
        const player = suite.player
        const enteredPlacements: string[] = []
        const sub = player.on('adBreakEntered', (e) =>
            enteredPlacements.push(e.adBreak.placement)
        )
        try {
            // Subscribe before playback so no event is missed.
            const adErrored = nextEventAsPromise(player, 'adError', {
                timeout: 30,
            })
            const contentPlaying = nextEventAsPromise(player, 'playing', {
                timeout: 40,
            })
            const midrollEntered = nextEventAsPromise(
                player,
                'adBreakEntered',
                {
                    filter: (e) => e.adBreak.placement === 'midroll',
                    timeout: 40,
                }
            )
            player.load({
                type: 'hls',
                uri: 'integ-adfail',
                manifestProvider: injectingManifestProvider(CONTENT_ASSET, [
                    {
                        id: 'preroll-fail',
                        startTime: 0,
                        duration: 6,
                        assetUri: 'this-ad-does-not-exist.m3u8',
                        cue: 'PRE',
                    },
                    // A playable midroll firing proves the resume gate cleared.
                    {
                        id: 'mid-ok',
                        startTime: 3,
                        duration: 6,
                        assetUri: AD_ASSET,
                    },
                ]),
            })
            await player.play().catch(() => undefined)

            await adErrored
            expect(player.currentAd).withContext('failed ad cleared').toBeNull()

            await contentPlaying
            expect(player.currentAdBreak)
                .withContext('break completed, resume gate not stuck')
                .toBeNull()
            expect(await poll(() => player.currentTime > 0, { timeout: 20 }))
                .withContext('content is playing, not stuck')
                .toBeTrue()

            await midrollEntered
            expect(enteredPlacements).toEqual(['preroll', 'midroll'])
        } finally {
            sub()
        }
    })
})
