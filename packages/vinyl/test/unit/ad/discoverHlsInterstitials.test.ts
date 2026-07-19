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

    it('resolves X-ASSET-URI to an absolute ad URI', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    duration: 10,
                    clientAttributes: { 'X-ASSET-URI': '../ads/ad.m3u8' },
                }),
            ],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].ads.length).toBe(1)
        expect(breaks[0].ads[0].uri).toBe('https://cdn.example.com/ads/ad.m3u8')
        expect(breaks[0].ads[0].startTime).toBe(0)
        expect(breaks[0].ads[0].duration).toBe(10)
    })

    it('yields no ads for an X-ASSET-LIST break', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    duration: 10,
                    clientAttributes: {
                        'X-ASSET-LIST': 'https://cdn.example.com/ads/list.json',
                    },
                }),
            ],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].ads).toEqual([])
    })

    it('carries client attributes through as metadata', () => {
        const playlist = makePlaylist({
            dateRanges: [
                makeRange({
                    clientAttributes: { 'X-SNAP': 'IN,OUT' },
                }),
            ],
        })
        const breaks = discoverHlsInterstitials(playlist, BASE)
        expect(breaks[0].metadata).toEqual({ 'X-SNAP': 'IN,OUT' })
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
})
