/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveValueProvider } from '@amazon/vinyl-util'

describe('resolveValueProvider', () => {
    it('resolves a direct value', async () => {
        const result = await resolveValueProvider(42)
        expect(result).toBe(42)
    })

    it('resolves a function returning a value', async () => {
        const result = await resolveValueProvider(() => 42)
        expect(result).toBe(42)
    })

    it('resolves a function returning a promise', async () => {
        const result = await resolveValueProvider(() => Promise.resolve(42))
        expect(result).toBe(42)
    })

    it('propagates rejected promises from function providers', async () => {
        const error = new Error('expected')

        await expectAsync(
            resolveValueProvider(() => Promise.reject(error))
        ).toBeRejectedWith(error)
    })

    it('works with non-primitive values', async () => {
        const obj = { a: 1 }

        expect(await resolveValueProvider(obj)).toBe(obj)
        expect(await resolveValueProvider(() => obj)).toBe(obj)
    })
})
