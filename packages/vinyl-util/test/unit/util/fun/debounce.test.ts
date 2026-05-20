/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createCallbackTimingTest,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import { debounce, DisposedError } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('debounce', () => {
    const clock = useMockTime()

    /**
     * Dashes mean wait 1s, x's mean invoke the throttled function.
     */
    function createMarbleTest(duration: number) {
        return createCallbackTimingTest(clock, (inner) =>
            debounce(inner, duration)
        )
    }

    it('invokes a callback after a period of inactivity', async () => {
        const test = createMarbleTest(3)
        expect(await test('x')).toBe('---x')
        expect(await test('xxx')).toBe('---x')
        expect(await test('x-x-x---')).toBe('-----x')
        expect(await test('--xx---xx-x')).toBe('-----x----x')
    })

    describe('dispose', () => {
        it('disposes pending timers', async () => {
            const spy = createSpy()
            const debounced = debounce(spy, 1)
            debounced()
            debounced.dispose()
            await clock.tick(2)
            expect(spy).not.toHaveBeenCalled()
            expect(debounced).toThrowError(DisposedError)
        })
    })
})
