/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getMediaPeriodAtTime,
    type MediaPeriod,
    type MediaTimeline,
} from '@amazon/vinyl'

describe('getMediaPeriodAtTime', () => {
    const period1: MediaPeriod = {
        startTime: 0,
        endTime: 10,
        qualities: [],
    }
    const period2: MediaPeriod = {
        startTime: 10,
        endTime: 20,
        qualities: [],
    }
    const period3: MediaPeriod = {
        startTime: 20,
        endTime: 30,
        qualities: [],
    }
    const timeline: MediaTimeline = {
        periods: [period1, period2, period3],
        minBufferTime: 2,
        getDuration: () => Promise.resolve(30),
    }

    it('returns the first period for time 0', () => {
        expect(getMediaPeriodAtTime(timeline, 0)).toBe(period1)
    })

    it('returns the first period for time within range', () => {
        expect(getMediaPeriodAtTime(timeline, 5)).toBe(period1)
    })

    it('returns the second period at the boundary', () => {
        expect(getMediaPeriodAtTime(timeline, 10)).toBe(period2)
    })

    it('returns the third period', () => {
        expect(getMediaPeriodAtTime(timeline, 25)).toBe(period3)
    })

    it('returns null for time past the last period', () => {
        expect(getMediaPeriodAtTime(timeline, 30)).toBeNull()
    })

    it('returns null for negative time', () => {
        expect(getMediaPeriodAtTime(timeline, -1)).toBeNull()
    })

    it('returns null for empty timeline', () => {
        const empty: MediaTimeline = {
            periods: [],
            minBufferTime: 0,
            getDuration: () => Promise.resolve(0),
        }
        expect(getMediaPeriodAtTime(empty, 5)).toBeNull()
    })
})
