/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { discoverHlsInterstitials } from '@amazon/vinyl'
import type { HlsDateRange, HlsMediaPlaylist } from '@amazon/vinyl-hls-parser'
import { resolveValueProvider } from '@amazon/vinyl-util'

describe('discoverHlsInterstitials', () => {
    const BASE = 'https://cdn.example.com/media/index.m3u8'
    const INTERSTITIAL = 'com.apple.hls.interstitial'

    function makePlaylist(
        overrides: Partial<HlsMediaPlaylist> = {}
    ): HlsMediaPlaylist {
        return {
            version: 7,
            targetDuration: 6,
            mediaSequence: 0,
            playlistType: 'VOD',
            ended: true,
            segments: [],
            dateRanges: [],
            ...overrides,
        }
    }

    function makeRange(overrides: Partial<HlsDateRange> = {}): HlsDateRange {
        return {
            id: 'ad1',
            classId: INTERSTITIAL,
            startDate: '2024-01-01T00:00:00.000Z',
            clientAttributes: {},
            ...overrides,
        }
    }

    /**
     * A minimal `fetch` Response stand-in that satisfies `requestWithRetry`
     * (which reads `ok`/`status`/`headers` and rejects on non-ok responses).
     */
    function okJsonResponse(body: unknown) {
        return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: () => Promise.resolve(body),
        }
    }

    it('returns empty when there are no date ranges', async () => {
        expect(await discoverHlsInterstitials(makePlaylist(), BASE)).toEqual([])
    })

    it('ignores non-interstitial date ranges', async () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ classId: 'com.example.other' })],
        })
        expect(await discoverHlsInterstitials(playlist, BASE)).toEqual([])
    })

    it('anchors a pre-roll to time 0 when no program-date-time exists', async () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ duration: 15 })],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks.length).toBe(1)
        expect(breaks[0].startTime).toBe(0)
        expect(breaks[0].duration).toBe(15)
        expect(breaks[0].placement).toBe('preroll')
    })

    it('correlates START-DATE against EXT-X-PROGRAM-DATE-TIME for a mid-roll', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 10,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
                {
                    uri: 'seg1.ts',
                    duration: 10,
                    sequenceNumber: 1,
                    discontinuity: false,
                },
            ],
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:12.000Z',
                    duration: 6,
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 20)
        expect(breaks[0].startTime).toBe(12)
        expect(breaks[0].placement).toBe('midroll')
    })

    it('uses a later segment program-date-time as the anchor', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 10,
                    sequenceNumber: 0,
                    discontinuity: false,
                },
                {
                    uri: 'seg1.ts',
                    duration: 10,
                    sequenceNumber: 1,
                    discontinuity: false,
                    // Anchor: media time 10 == this wall clock.
                    programDateTime: '2024-01-01T00:00:10.000Z',
                },
            ],
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:15.000Z',
                    duration: 5,
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 20)
        // 10 (anchor media time) + (15 - 10) = 15
        expect(breaks[0].startTime).toBe(15)
    })

    it('resolves duration from END-DATE when DURATION is absent', async () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-01-01T00:00:08.000Z',
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBe(8)
    })

    it('falls back to PLANNED-DURATION when neither DURATION nor END-DATE exist', async () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ plannedDuration: 12 })],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBe(12)
    })

    it('reports null duration when unresolvable', async () => {
        const playlist = makePlaylist({ dateRanges: [makeRange()] })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBeNull()
    })

    it('resolves X-ASSET-URI to an absolute ad URI', async () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    duration: 10,
                    clientAttributes: { 'X-ASSET-URI': '../ads/ad.m3u8' },
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        const ads = await resolveValueProvider(breaks[0].ads)
        expect(ads.length).toBe(1)
        expect(ads[0].uri).toBe('https://cdn.example.com/ads/ad.m3u8')
        expect(ads[0].startTime).toBe(0)
        expect(ads[0].duration).toBe(10)
    })

    it('yields no ads for a break with neither X-ASSET-URI nor X-ASSET-LIST', async () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ duration: 10 })],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(await resolveValueProvider(breaks[0].ads)).toEqual([])
    })

    it('parses X-RESTRICT into typed restrict field', async () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    duration: 10,
                    clientAttributes: { 'X-RESTRICT': 'SKIP,JUMP' },
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].restrict).toEqual({ skip: true, jump: true })
    })

    it('resolves X-ASSET-LIST ads by fetching the list JSON', async () => {
        const origFetch = globalThis.fetch
        const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
            okJsonResponse({
                ASSETS: [
                    { URI: 'mid1.m3u8', DURATION: 10 },
                    { URI: 'https://cdn.example.com/mid2.m3u8' },
                ],
            })
        )
        globalThis.fetch = fetchSpy
        try {
            const playlist = makePlaylist({
                dateRanges: [
                    makeRange({
                        duration: 10,
                        clientAttributes: {
                            'X-ASSET-LIST': 'https://example.com/ads.json',
                        },
                    }),
                ],
            })
            const breaks = await discoverHlsInterstitials(playlist, BASE)
            const ads = await resolveValueProvider(breaks[0].ads)
            expect(fetchSpy.calls.argsFor(0)[0]).toBe(
                'https://example.com/ads.json'
            )
            expect(ads.length).toBe(2)
            expect(ads[0].uri).toBe('https://cdn.example.com/media/mid1.m3u8')
            expect(ads[0].duration).toBe(10)
            expect(ads[1].uri).toBe('https://cdn.example.com/mid2.m3u8')
            expect(ads[1].duration).toBeNull()
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('caches the X-ASSET-LIST fetch across calls', async () => {
        const origFetch = globalThis.fetch
        const fetchSpy = jasmine
            .createSpy('fetch')
            .and.resolveTo(okJsonResponse({ ASSETS: [{ URI: 'x.m3u8' }] }))
        globalThis.fetch = fetchSpy
        try {
            const playlist = makePlaylist({
                dateRanges: [
                    makeRange({
                        duration: 10,
                        clientAttributes: {
                            'X-ASSET-LIST': 'https://example.com/ads.json',
                        },
                    }),
                ],
            })
            const breaks = await discoverHlsInterstitials(playlist, BASE)
            const resolver = breaks[0].ads
            await resolveValueProvider(resolver)
            await resolveValueProvider(resolver)
            expect(fetchSpy).toHaveBeenCalledTimes(1)
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('memoizes the X-ASSET-LIST resolution, including failures, within a discovery', async () => {
        // The per-break ads resolver is memoized, so a failed asset-list fetch
        // is cached for the lifetime of the discovered break (a fresh discovery
        // re-fetches). This documents the shipped behavior.
        const origFetch = globalThis.fetch
        const fetchSpy = jasmine
            .createSpy('fetch')
            .and.rejectWith(new Error('network'))
        globalThis.fetch = fetchSpy
        try {
            const playlist = makePlaylist({
                dateRanges: [
                    makeRange({
                        duration: 10,
                        clientAttributes: {
                            'X-ASSET-LIST': 'https://example.com/ads.json',
                        },
                    }),
                ],
            })
            const breaks = await discoverHlsInterstitials(playlist, BASE)
            const resolver = breaks[0].ads
            await expectAsync(resolveValueProvider(resolver)).toBeRejected()
            // The rejected resolution is memoized: a second call reuses the
            // cached (rejected) result and does not fetch again.
            const callsAfterFirst = fetchSpy.calls.count()
            await expectAsync(resolveValueProvider(resolver)).toBeRejected()
            expect(fetchSpy.calls.count()).toBe(callsAfterFirst)
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('yields empty ads when X-ASSET-LIST JSON has no ASSETS', async () => {
        const origFetch = globalThis.fetch
        globalThis.fetch = jasmine
            .createSpy('fetch')
            .and.resolveTo(okJsonResponse({}))
        try {
            const playlist = makePlaylist({
                dateRanges: [
                    makeRange({
                        duration: 10,
                        clientAttributes: {
                            'X-ASSET-LIST': 'https://example.com/ads.json',
                        },
                    }),
                ],
            })
            const breaks = await discoverHlsInterstitials(playlist, BASE)
            expect(await resolveValueProvider(breaks[0].ads)).toEqual([])
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('classifies a break at the end of content as a post-roll', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 30,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
            ],
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:30.000Z',
                    duration: 10,
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].placement).toBe('postroll')
    })

    it('skips an interstitial with no START-DATE (e.g. END-ON-NEXT)', async () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({ startDate: '', endOnNext: true, duration: 5 }),
            ],
        })
        expect(await discoverHlsInterstitials(playlist, BASE)).toEqual([])
    })

    it('skips an interstitial with an unparseable START-DATE', async () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ startDate: 'not-a-date', duration: 5 })],
        })
        expect(await discoverHlsInterstitials(playlist, BASE)).toEqual([])
    })

    it('clamps a slightly-negative correlated start time to 0', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 30,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
            ],
            dateRanges: [
                makeRange({
                    // 200ms before the anchor — within the clamp epsilon.
                    startDate: '2023-12-31T23:59:59.800Z',
                    duration: 5,
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].startTime).toBe(0)
        expect(breaks[0].placement).toBe('preroll')
    })

    it('ignores a program-date-time that cannot be parsed', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 30,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: 'bogus',
                },
            ],
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:10.000Z',
                    duration: 5,
                }),
            ],
        })
        // No usable anchor → treated as a best-effort pre-roll at time 0.
        const breaks = await discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].startTime).toBe(0)
    })

    it('ignores an END-DATE that precedes START-DATE', async () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:10.000Z',
                    endDate: '2024-01-01T00:00:05.000Z',
                }),
            ],
        })
        // Invalid span → duration falls through to null.
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBeNull()
    })

    it('classifies a null-duration break near content end as a post-roll', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 30,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
            ],
            dateRanges: [makeRange({ startDate: '2024-01-01T00:00:30.000Z' })],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].duration).toBeNull()
        expect(breaks[0].placement).toBe('postroll')
    })

    it('sorts breaks by start time', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 60,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
            ],
            dateRanges: [
                makeRange({
                    id: 'late',
                    startDate: '2024-01-01T00:00:40.000Z',
                    duration: 5,
                }),
                makeRange({
                    id: 'early',
                    startDate: '2024-01-01T00:00:10.000Z',
                    duration: 5,
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 60)
        expect(breaks.map((b) => b.id)).toEqual(['early', 'late'])
    })

    it('uses CUE=PRE to classify preroll and set startTime to 0', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    duration: 6,
                    uri: 's0.ts',
                    programDateTime: '2024-01-01T00:00:00.000Z',
                    sequenceNumber: 0,
                    discontinuity: false,
                },
            ],
            dateRanges: [
                makeRange({
                    id: 'pre',
                    startDate: '2024-01-01T00:00:10.000Z',
                    duration: 6,
                    clientAttributes: { 'X-ASSET-URI': 'ad.m3u8', CUE: 'PRE' },
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 60)
        expect(breaks[0].placement).toBe('preroll')
        expect(breaks[0].startTime).toBe(0)
    })

    it('uses CUE=POST to classify postroll', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    duration: 6,
                    uri: 's0.ts',
                    programDateTime: '2024-01-01T00:00:00.000Z',
                    sequenceNumber: 0,
                    discontinuity: false,
                },
            ],
            dateRanges: [
                makeRange({
                    id: 'post',
                    startDate: '2024-01-01T00:00:30.000Z',
                    duration: 10,
                    clientAttributes: { 'X-ASSET-URI': 'ad.m3u8', CUE: 'POST' },
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE, 60)
        expect(breaks[0].placement).toBe('postroll')
    })

    it('uses X-PLAYOUT-LIMIT to cap duration', async () => {
        const playlist = makePlaylist({
            segments: [
                {
                    duration: 6,
                    uri: 's0.ts',
                    programDateTime: '2024-01-01T00:00:00.000Z',
                    sequenceNumber: 0,
                    discontinuity: false,
                },
            ],
            dateRanges: [
                makeRange({
                    id: 'limited',
                    startDate: '2024-01-01T00:00:10.000Z',
                    duration: 600,
                    clientAttributes: {
                        'X-ASSET-URI': 'ad.m3u8',
                        'X-PLAYOUT-LIMIT': '10.0',
                    },
                }),
            ],
        })
        const breaks = await discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBe(10)
    })

    // ─── CUE token list / X-RESUME-OFFSET / X-PLAYOUT-LIMIT field ─────────
    const ANCHOR_SEG = {
        uri: 's0.ts',
        duration: 60,
        sequenceNumber: 0,
        discontinuity: false,
        programDateTime: '2024-01-01T00:00:00.000Z',
    }

    /** A playlist anchored at t=0 carrying a single interstitial range. */
    function anchored(range: Partial<HlsDateRange>): HlsMediaPlaylist {
        return makePlaylist({
            segments: [ANCHOR_SEG],
            dateRanges: [makeRange(range)],
        })
    }

    function attrs(cue?: string, extra: Record<string, string> = {}) {
        return {
            'X-ASSET-URI': 'ad.m3u8',
            ...(cue == null ? {} : { CUE: cue }),
            ...extra,
        }
    }

    it('tokenizes a CUE list, honoring PRE and ONCE together', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs('PRE,ONCE'),
            }),
            BASE,
            60
        )
        expect(breaks[0].placement).toBe('preroll')
        expect(breaks[0].startTime).toBe(0)
        expect(breaks[0].once).toBeTrue()
    })

    it('marks a bare CUE=ONCE break once, leaving placement to the heuristic', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs('ONCE'),
            }),
            BASE,
            60
        )
        expect(breaks[0].placement).toBe('midroll')
        expect(breaks[0].once).toBeTrue()
    })

    it('honors POST together with ONCE', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:30.000Z',
                duration: 6,
                clientAttributes: attrs('POST,ONCE'),
            }),
            BASE,
            60
        )
        expect(breaks[0].placement).toBe('postroll')
        expect(breaks[0].once).toBeTrue()
    })

    it('ignores unknown CUE tokens', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs('PRE,FOO'),
            }),
            BASE,
            60
        )
        expect(breaks[0].placement).toBe('preroll')
        expect(breaks[0].once).toBeFalse()
    })

    it('lets PRE win when CUE illegally lists both PRE and POST', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs('PRE,POST'),
            }),
            BASE,
            60
        )
        expect(breaks[0].placement).toBe('preroll')
    })

    it('tokenizes CUE case- and whitespace-insensitively', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(' once , pre '),
            }),
            BASE,
            60
        )
        expect(breaks[0].once).toBeTrue()
        expect(breaks[0].placement).toBe('preroll')
    })

    it('defaults once to false when there is no CUE', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(),
            }),
            BASE,
            60
        )
        expect(breaks[0].once).toBeFalse()
    })

    it('parses X-RESUME-OFFSET, distinguishing a present 0 from absent', async () => {
        const zero = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(undefined, { 'X-RESUME-OFFSET': '0' }),
            }),
            BASE,
            60
        )
        expect(zero[0].resumeOffset).toBe(0)

        const absent = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(),
            }),
            BASE,
            60
        )
        expect(absent[0].resumeOffset).toBeNull()
    })

    it('parses a signed / fractional X-RESUME-OFFSET and rejects garbage', async () => {
        const neg = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(undefined, { 'X-RESUME-OFFSET': '-5' }),
            }),
            BASE,
            60
        )
        expect(neg[0].resumeOffset).toBe(-5)

        const frac = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(undefined, {
                    'X-RESUME-OFFSET': '15.0',
                }),
            }),
            BASE,
            60
        )
        expect(frac[0].resumeOffset).toBe(15)

        const garbage = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(undefined, {
                    'X-RESUME-OFFSET': 'nope',
                }),
            }),
            BASE,
            60
        )
        expect(garbage[0].resumeOffset).toBeNull()
    })

    it('carries X-PLAYOUT-LIMIT as its own field, even without a DURATION', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                clientAttributes: attrs(undefined, { 'X-PLAYOUT-LIMIT': '8' }),
            }),
            BASE,
            60
        )
        expect(breaks[0].playoutLimit).toBe(8)
        // No DURATION/END-DATE/PLANNED-DURATION → duration unresolved, but the
        // pod-total cap survives (previously it was dropped).
        expect(breaks[0].duration).toBeNull()
    })

    it('reports a null playoutLimit when X-PLAYOUT-LIMIT is absent', async () => {
        const breaks = await discoverHlsInterstitials(
            anchored({
                startDate: '2024-01-01T00:00:20.000Z',
                duration: 6,
                clientAttributes: attrs(),
            }),
            BASE,
            60
        )
        expect(breaks[0].playoutLimit).toBeNull()
    })
})
