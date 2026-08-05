/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { discoverHlsInterstitials } from '@amazon/vinyl'
import type { DateRange, MediaPlaylist } from '@amazon/vinyl-hls-parser'

describe('discoverHlsInterstitials', () => {
    const BASE = 'https://cdn.example.com/media/index.m3u8'
    const INTERSTITIAL = 'com.apple.hls.interstitial'

    function makePlaylist(
        overrides: Partial<MediaPlaylist> = {}
    ): MediaPlaylist {
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

    function makeRange(overrides: Partial<DateRange> = {}): DateRange {
        return {
            id: 'ad1',
            classId: INTERSTITIAL,
            startDate: '2024-01-01T00:00:00.000Z',
            clientAttributes: {},
            ...overrides,
        }
    }

    it('returns empty when there are no date ranges', () => {
        expect(discoverHlsInterstitials(makePlaylist(), BASE)).toEqual([])
    })

    it('ignores non-interstitial date ranges', () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ classId: 'com.example.other' })],
        })
        expect(discoverHlsInterstitials(playlist, BASE)).toEqual([])
    })

    it('anchors a pre-roll to time 0 when no program-date-time exists', () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ duration: 15 })],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks.length).toBe(1)
        expect(breaks[0].startTime).toBe(0)
        expect(breaks[0].duration).toBe(15)
        expect(breaks[0].placement).toBe('preroll')
    })

    it('correlates START-DATE against EXT-X-PROGRAM-DATE-TIME for a mid-roll', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 20)
        expect(breaks[0].startTime).toBe(12)
        expect(breaks[0].placement).toBe('midroll')
    })

    it('uses a later segment program-date-time as the anchor', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 20)
        // 10 (anchor media time) + (15 - 10) = 15
        expect(breaks[0].startTime).toBe(15)
    })

    it('resolves duration from END-DATE when DURATION is absent', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:00.000Z',
                    endDate: '2024-01-01T00:00:08.000Z',
                }),
            ],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBe(8)
    })

    it('falls back to PLANNED-DURATION when neither DURATION nor END-DATE exist', () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ plannedDuration: 12 })],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBe(12)
    })

    it('reports null duration when unresolvable', () => {
        const playlist = makePlaylist({ dateRanges: [makeRange()] })
        const breaks = discoverHlsInterstitials(playlist, BASE)
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
        const breaks = discoverHlsInterstitials(playlist, BASE)
        const ads = await breaks[0].ads()
        expect(ads.length).toBe(1)
        expect(ads[0].uri).toBe('https://cdn.example.com/ads/ad.m3u8')
        expect(ads[0].startTime).toBe(0)
        expect(ads[0].duration).toBe(10)
        expect(ads[0].index).toBe(0)
        expect(ads[0].totalAds).toBe(1)
    })

    it('yields no ads for a break with neither X-ASSET-URI nor X-ASSET-LIST', async () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ duration: 10 })],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(await breaks[0].ads()).toEqual([])
    })

    it('parses X-RESTRICT into typed restrict field', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    duration: 10,
                    clientAttributes: { 'X-RESTRICT': 'SKIP,JUMP' },
                }),
            ],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].restrict).toEqual({ skip: true, jump: true })
    })

    it('resolves X-ASSET-LIST ads by fetching the list JSON', async () => {
        const origFetch = globalThis.fetch
        globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
            json: () =>
                Promise.resolve({
                    ASSETS: [
                        { URI: 'mid1.m3u8', DURATION: 10 },
                        { URI: 'https://cdn.example.com/mid2.m3u8' },
                    ],
                }),
        })
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
            const breaks = discoverHlsInterstitials(playlist, BASE)
            const ads = await breaks[0].ads()
            expect(globalThis.fetch).toHaveBeenCalledWith(
                'https://example.com/ads.json'
            )
            expect(ads.length).toBe(2)
            expect(ads[0].uri).toBe('https://cdn.example.com/media/mid1.m3u8')
            expect(ads[0].duration).toBe(10)
            expect(ads[0].index).toBe(0)
            expect(ads[0].totalAds).toBe(2)
            expect(ads[1].uri).toBe('https://cdn.example.com/mid2.m3u8')
            expect(ads[1].duration).toBeNull()
            expect(ads[1].index).toBe(1)
            expect(ads[1].totalAds).toBe(2)
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('caches the X-ASSET-LIST fetch across calls', async () => {
        const origFetch = globalThis.fetch
        const fetchSpy = jasmine.createSpy('fetch').and.resolveTo({
            json: () => Promise.resolve({ ASSETS: [{ URI: 'x.m3u8' }] }),
        })
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
            const resolver = discoverHlsInterstitials(playlist, BASE)[0].ads
            await resolver()
            await resolver()
            expect(fetchSpy).toHaveBeenCalledTimes(1)
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('allows retry after an X-ASSET-LIST fetch failure', async () => {
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
            const resolver = discoverHlsInterstitials(playlist, BASE)[0].ads
            await expectAsync(resolver()).toBeRejected()
            // A subsequent call retries rather than returning the cached
            // rejection.
            await expectAsync(resolver()).toBeRejected()
            expect(fetchSpy).toHaveBeenCalledTimes(2)
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('yields empty ads when X-ASSET-LIST JSON has no ASSETS', async () => {
        const origFetch = globalThis.fetch
        globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
            json: () => Promise.resolve({}),
        })
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
            const breaks = discoverHlsInterstitials(playlist, BASE)
            expect(await breaks[0].ads()).toEqual([])
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('classifies a break at the end of content as a post-roll', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].placement).toBe('postroll')
    })

    it('skips an interstitial with no START-DATE (e.g. END-ON-NEXT)', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({ startDate: '', endOnNext: true, duration: 5 }),
            ],
        })
        expect(discoverHlsInterstitials(playlist, BASE)).toEqual([])
    })

    it('skips an interstitial with an unparseable START-DATE', () => {
        const playlist = makePlaylist({
            dateRanges: [makeRange({ startDate: 'not-a-date', duration: 5 })],
        })
        expect(discoverHlsInterstitials(playlist, BASE)).toEqual([])
    })

    it('clamps a slightly-negative correlated start time to 0', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].startTime).toBe(0)
        expect(breaks[0].placement).toBe('preroll')
    })

    it('ignores a program-date-time that cannot be parsed', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].startTime).toBe(0)
    })

    it('ignores an END-DATE that precedes START-DATE', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    startDate: '2024-01-01T00:00:10.000Z',
                    endDate: '2024-01-01T00:00:05.000Z',
                }),
            ],
        })
        // Invalid span → duration falls through to null.
        expect(discoverHlsInterstitials(playlist, BASE)[0].duration).toBeNull()
    })

    it('classifies a null-duration break near content end as a post-roll', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 30)
        expect(breaks[0].duration).toBeNull()
        expect(breaks[0].placement).toBe('postroll')
    })

    it('sorts breaks by start time', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 60)
        expect(breaks.map((b) => b.id)).toEqual(['early', 'late'])
    })

    it('uses CUE=PRE to classify preroll and set startTime to 0', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 60)
        expect(breaks[0].placement).toBe('preroll')
        expect(breaks[0].startTime).toBe(0)
    })

    it('uses CUE=POST to classify postroll', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE, 60)
        expect(breaks[0].placement).toBe('postroll')
    })

    it('uses X-PLAYOUT-LIMIT to cap duration', () => {
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
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].duration).toBe(10)
    })
})
