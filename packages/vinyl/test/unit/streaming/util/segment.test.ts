/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getSegmentAtTime,
    getSegmentInsertionIndexAtTime,
    type MediaSegmentMetadata,
} from '@amazon/vinyl'
import objectContaining = jasmine.objectContaining

describe('segment utils', () => {
    const segments = [
        {
            timestampOffset: 0,
            startTime: 0,
            endTime: 10,
        },
        {
            timestampOffset: 10,
            startTime: 10,
            endTime: 20,
        },
        {
            timestampOffset: 20,
            startTime: 20,
            endTime: 30,
        },
        {
            timestampOffset: 30,
            startTime: 30,
            endTime: 40,
        },
    ] as const satisfies MediaSegmentMetadata[]

    describe('getSegmentAtTime', () => {
        it('returns the segment at the given time', () => {
            expect(getSegmentAtTime(0, segments)).toEqual(
                objectContaining({ startTime: 0 })
            )
            expect(getSegmentAtTime(10, segments)).toEqual(
                objectContaining({ startTime: 10 })
            )
            expect(getSegmentAtTime(19.99, segments)).toEqual(
                objectContaining({ startTime: 10 })
            )
            expect(getSegmentAtTime(20, segments)).toEqual(
                objectContaining({ startTime: 20 })
            )
            expect(getSegmentAtTime(25, segments)).toEqual(
                objectContaining({ startTime: 20 })
            )
            expect(getSegmentAtTime(30, segments)).toEqual(
                objectContaining({ startTime: 30 })
            )
            expect(getSegmentAtTime(39.999, segments)).toEqual(
                objectContaining({ startTime: 30 })
            )
        })

        describe('when no segments span the provided time', () => {
            it('returns null', () => {
                expect(getSegmentAtTime(0, [])).toBeNull()
                expect(getSegmentAtTime(10, [])).toBeNull()
                expect(getSegmentAtTime(100, segments)).toBeNull()
                expect(getSegmentAtTime(-1, segments)).toBeNull()
                expect(getSegmentAtTime(40, segments)).toBeNull()
            })
        })

        describe('with a forward-snap affordance', () => {
            it('snaps forward to the next segment when time is within affordance of its start', () => {
                expect(getSegmentAtTime(9.9, segments, 0.2)).toEqual(
                    objectContaining({ startTime: 10 })
                )
                expect(getSegmentAtTime(19.85, segments, 0.2)).toEqual(
                    objectContaining({ startTime: 20 })
                )
            })

            it('does not snap forward when the gap exceeds affordance', () => {
                expect(getSegmentAtTime(9.5, segments, 0.2)).toEqual(
                    objectContaining({ startTime: 0 })
                )
            })

            it('returns the next segment even when the previous one still covers time', () => {
                // Documented trade-off: time=9.9 is covered by [0,10) but
                // affordance forward-snaps to [10,20).
                expect(getSegmentAtTime(9.9, segments, 0.2)).toEqual(
                    objectContaining({ startTime: 10 })
                )
            })

            it('snaps forward into the first segment when time is just before 0', () => {
                expect(getSegmentAtTime(-0.1, segments, 0.2)).toEqual(
                    objectContaining({ startTime: 0 })
                )
            })

            it('returns null when the snapped lookup lands past the last segment', () => {
                expect(getSegmentAtTime(40, segments, 0.2)).toBeNull()
                expect(getSegmentAtTime(39.9, segments, 0.2)).toEqual(
                    objectContaining({ startTime: 30 })
                )
            })

            it('still gates on the original time against endTime', () => {
                // time + affordance lands in [0,10), but endTime is exclusive
                // and time itself is at endTime — must return null.
                expect(getSegmentAtTime(10, segments, 0)).toEqual(
                    objectContaining({ startTime: 10 })
                )
                // With one-segment list and affordance, time at endTime returns null.
                const oneSegment = [segments[0]]
                expect(getSegmentAtTime(10, oneSegment, 0.2)).toBeNull()
            })
        })
    })

    describe('getSegmentInsertionIndexAtTime', () => {
        it('returns the segment insertion index at the given time', () => {
            expect(getSegmentInsertionIndexAtTime(0, [])).toBe(0)
            expect(getSegmentInsertionIndexAtTime(-10, segments)).toBe(0)
            expect(getSegmentInsertionIndexAtTime(0, segments)).toBe(1)
            expect(getSegmentInsertionIndexAtTime(10, segments)).toBe(2)
            expect(getSegmentInsertionIndexAtTime(19.99, segments)).toBe(2)
            expect(getSegmentInsertionIndexAtTime(20, segments)).toBe(3)
            expect(getSegmentInsertionIndexAtTime(30, segments)).toBe(4)
            expect(getSegmentInsertionIndexAtTime(40, segments)).toBe(4)
            expect(getSegmentInsertionIndexAtTime(50, segments)).toBe(4)
        })
    })
})
