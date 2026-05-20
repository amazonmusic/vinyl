/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createShortUid } from '@amazon/vinyl-util'

describe('createShortUid', () => {
    it('creates a unique id', () => {
        const set = new Set<string>()
        // Do a smoke test to test for collisions
        // Testing as many UIDs that can fit within one millisecond.
        for (let i = 0; i < 2000; i++) {
            const uid = createShortUid()
            expect(set.has(uid)).toBeFalse()
            set.add(uid)
        }
    })

    it('creates a UID with 7-22 a-zA-Z0-9 characters', () => {
        for (let i = 0; i < 10_000; i++) {
            const uid = createShortUid()
            expect(uid).toMatch(/[a-zA-Z0-9]{7,22}/)
        }
    })
})
