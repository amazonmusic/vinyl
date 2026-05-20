/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { hlsByteRangeToMediaRange } from '@amazon/vinyl'

describe('hlsByteRangeToMediaRange', () => {
    it('converts HLS byte range to media range', () => {
        expect(hlsByteRangeToMediaRange({ offset: 100, length: 200 })).toEqual([
            100, 299,
        ])
    })

    it('handles zero offset', () => {
        expect(hlsByteRangeToMediaRange({ offset: 0, length: 50 })).toEqual([
            0, 49,
        ])
    })

    it('handles length of 1', () => {
        expect(hlsByteRangeToMediaRange({ offset: 10, length: 1 })).toEqual([
            10, 10,
        ])
    })
})
