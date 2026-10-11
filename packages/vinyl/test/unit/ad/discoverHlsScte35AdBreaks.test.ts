/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { discoverHlsScte35AdBreaks } from '@amazon/vinyl'
import type {
    HlsDateRange,
    HlsMediaPlaylist,
    HlsSegment,
} from '@amazon/vinyl-hls-parser'
import {
    segmentationDescriptor,
    spliceInfoSection,
    spliceInsertHex,
    timeSignalCommand,
    toHex,
} from './scte35/scte35TestUtil'

describe('discoverHlsScte35AdBreaks', () => {
    const ANCHOR = Date.parse('2024-01-01T00:00:00.000Z')

    function date(seconds: number): string {
        return new Date(ANCHOR + seconds * 1000).toISOString()
    }

    /**
     * Segments of the given durations; a `|` before a duration marks a
     * discontinuity, which also carries a program date time.
     */
    function makeSegments(
        layout: readonly (number | '|')[],
        { pdt = true }: { readonly pdt?: boolean } = {}
    ): HlsSegment[] {
        const segments: HlsSegment[] = []
        let time = 0
        let discontinuity = false
        for (const item of layout) {
            if (item === '|') {
                discontinuity = true
                continue
            }
            segments.push({
                uri: `s${segments.length}.m4s`,
                duration: item,
                sequenceNumber: segments.length,
                discontinuity,
                ...(pdt &&
                    (segments.length === 0 || discontinuity) && {
                        programDateTime: date(time),
                    }),
            })
            discontinuity = false
            time += item
        }
        return segments
    }

    function makePlaylist(
        dateRanges: HlsDateRange[],
        segments = makeSegments([10, 10, 10, '|', 5, '|', 5, '|', 10, 10])
    ): HlsMediaPlaylist {
        return {
            version: 7,
            targetDuration: 10,
            mediaSequence: 0,
            playlistType: 'VOD',
            ended: true,
            segments,
            dateRanges,
        }
    }

    function makeRange(overrides: Partial<HlsDateRange> = {}): HlsDateRange {
        return {
            id: 'splice-1',
            startDate: date(30),
            clientAttributes: {},
            ...overrides,
        }
    }

    const OUT = spliceInsertHex({
        eventId: 1,
        outOfNetwork: true,
        ptsTime: 30 * 90000,
        breakDuration: 10 * 90000,
    })
    const IN = spliceInsertHex({ eventId: 1, outOfNetwork: false })

    it('merges SCTE35-OUT and SCTE35-IN date ranges into a stitched break', () => {
        const breaks = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    plannedDuration: 12,
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
                makeRange({
                    duration: 10,
                    endDate: date(40),
                    clientAttributes: { 'SCTE35-IN': IN },
                }),
            ]),
            60
        )
        expect(breaks.length).toBe(1)
        const [adBreak] = breaks
        expect(adBreak).toEqual(
            jasmine.objectContaining({
                id: 'splice-1',
                startTime: 30,
                duration: 10,
                placement: 'midroll',
                insertion: 'stitched',
                once: false,
                resumeOffset: 10,
                playoutLimit: null,
                resolutionTimeOffset: null,
                restrict: {},
                skipControl: null,
            })
        )
        // Each discontinuity within the break starts an ad.
        expect(adBreak.ads).toEqual([
            { id: 'splice-1-0', startTime: 30, duration: 5, uri: null },
            { id: 'splice-1-1', startTime: 35, duration: 5, uri: null },
        ])
        expect(adBreak.signal?.source).toBe('hls-scte35')
        expect(adBreak.signal?.schemeIdUri).toBeNull()
        expect(adBreak.signal?.scte35.map((s) => s.command.type)).toEqual([
            'spliceInsert',
            'spliceInsert',
        ])
    })

    it('takes the duration from END-DATE, PLANNED-DURATION, then SCTE-35', () => {
        const duration = (range: Partial<HlsDateRange>) =>
            discoverHlsScte35AdBreaks(
                makePlaylist([
                    makeRange({
                        ...range,
                        clientAttributes: { 'SCTE35-OUT': OUT },
                    }),
                ])
            )[0].duration
        expect(duration({ endDate: date(38) })).toBe(8)
        expect(duration({ plannedDuration: 7 })).toBe(7)
        expect(duration({})).toBe(10)
        expect(
            discoverHlsScte35AdBreaks(
                makePlaylist([
                    makeRange({
                        clientAttributes: {
                            'SCTE35-OUT': spliceInsertHex({
                                eventId: 1,
                                outOfNetwork: true,
                            }),
                        },
                    }),
                ])
            )[0]
        ).toEqual(
            jasmine.objectContaining({
                duration: null,
                ads: [
                    {
                        id: 'splice-1-0',
                        startTime: 30,
                        duration: null,
                        uri: null,
                    },
                ],
            })
        )
    })

    it('ignores an invalid END-DATE', () => {
        const [adBreak] = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    endDate: 'not a date',
                    plannedDuration: 6,
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
            ])
        )
        expect(adBreak.duration).toBe(6)
    })

    it('opens a break from a SCTE35-CMD time_signal placement opportunity', () => {
        const cmd = toHex(
            spliceInfoSection({
                commandType: 0x06,
                command: timeSignalCommand(30 * 90000),
                descriptors: [
                    segmentationDescriptor({
                        eventId: 200,
                        typeId: 0x34,
                        duration: 10 * 90000,
                    }),
                ],
            })
        )
        const [adBreak] = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    id: 'cmd',
                    clientAttributes: { 'SCTE35-CMD': cmd },
                }),
            ])
        )
        expect(adBreak).toEqual(
            jasmine.objectContaining({ id: 'cmd', startTime: 30, duration: 10 })
        )
    })

    it('ignores SCTE35-CMD ranges that do not open an avail', () => {
        const cmd = toHex(spliceInfoSection({ commandType: 0x00, command: [] }))
        expect(
            discoverHlsScte35AdBreaks(
                makePlaylist([
                    makeRange({ clientAttributes: { 'SCTE35-CMD': cmd } }),
                ])
            )
        ).toEqual([])
    })

    it('places a lone SCTE35-IN with a known duration', () => {
        const breaks = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    duration: 10,
                    clientAttributes: { 'SCTE35-IN': IN },
                }),
            ])
        )
        expect(breaks.length).toBe(1)
        expect(breaks[0].startTime).toBe(30)
        expect(
            discoverHlsScte35AdBreaks(
                makePlaylist([
                    makeRange({ clientAttributes: { 'SCTE35-IN': IN } }),
                ])
            )
        ).toEqual([])
    })

    it('keeps a break whose SCTE-35 cannot be decoded', () => {
        const [adBreak] = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    duration: 10,
                    clientAttributes: { 'SCTE35-OUT': '0xZZ' },
                }),
            ])
        )
        expect(adBreak.startTime).toBe(30)
        expect(adBreak.signal?.scte35).toEqual([])
    })

    it('classifies pre-rolls and post-rolls', () => {
        const breaks = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    id: 'pre',
                    startDate: date(0),
                    duration: 10,
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
                makeRange({
                    id: 'post',
                    startDate: date(50),
                    duration: 10,
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
            ]),
            60
        )
        expect(breaks.map((b) => [b.id, b.placement])).toEqual([
            ['pre', 'preroll'],
            ['post', 'postroll'],
        ])
    })

    it('maps dates by the closest preceding program date time', () => {
        // The ad's program date time jumps: wall clock does not track media time
        // across the discontinuity.
        const segments = makeSegments([
            10,
            10,
            10,
            '|',
            5,
            '|',
            5,
            '|',
            10,
            10,
        ]).map((segment, i) =>
            i === 3 ? { ...segment, programDateTime: date(1000) } : segment
        )
        const [adBreak] = discoverHlsScte35AdBreaks(
            makePlaylist(
                [
                    makeRange({
                        startDate: date(1002),
                        duration: 4,
                        clientAttributes: { 'SCTE35-OUT': OUT },
                    }),
                ],
                segments
            )
        )
        expect(adBreak.startTime).toBe(32)
    })

    it('sorts breaks and skips interstitial, non-SCTE, and undated ranges', () => {
        const breaks = discoverHlsScte35AdBreaks(
            makePlaylist([
                makeRange({
                    id: 'b',
                    startDate: date(40),
                    duration: 5,
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
                makeRange({
                    id: 'a',
                    startDate: date(20),
                    duration: 5,
                    classId: 'com.example.ssai',
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
                makeRange({
                    id: 'interstitial',
                    classId: 'com.apple.hls.interstitial',
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
                makeRange({ id: 'plain', clientAttributes: {} }),
                makeRange({
                    id: 'undated',
                    startDate: 'nope',
                    clientAttributes: { 'SCTE35-OUT': OUT },
                }),
            ])
        )
        expect(breaks.map((b) => b.id)).toEqual(['a', 'b'])
        expect(breaks[0].signal?.schemeIdUri).toBe('com.example.ssai')
    })

    it('returns no breaks without a program date time', () => {
        expect(
            discoverHlsScte35AdBreaks(
                makePlaylist(
                    [makeRange({ clientAttributes: { 'SCTE35-OUT': OUT } })],
                    makeSegments([10, 10], { pdt: false })
                )
            )
        ).toEqual([])
    })

    it('ignores an unparseable program date time', () => {
        const segments = makeSegments([10, 10, 10, '|', 5, 5]).map(
            (segment, i) =>
                i === 0 ? { ...segment, programDateTime: 'nope' } : segment
        )
        // Only the anchor at the discontinuity (media time 30) remains, and
        // dates before it map from it.
        const [adBreak] = discoverHlsScte35AdBreaks(
            makePlaylist(
                [
                    makeRange({
                        startDate: date(10),
                        duration: 5,
                        clientAttributes: { 'SCTE35-OUT': OUT },
                    }),
                ],
                segments
            )
        )
        expect(adBreak.startTime).toBe(10)
    })
})
