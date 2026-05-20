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
