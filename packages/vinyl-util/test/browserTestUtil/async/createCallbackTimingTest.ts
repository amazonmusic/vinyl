/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { marbleTest } from './marble'
import type { MockTime } from './async'
import Spy = jasmine.Spy
import createSpy = jasmine.createSpy

/**
 * Creates a marble test for callback timing.
 * This provides an easy way to test callback timing, for example a debounce or throttle function.
 *
 * The returned function takes an input string where dashes represent a wait of 1 second, and x's represent
 * invoking the function returned by wrapCallback. The resolved string will be the timing of when the inner function is
 * invoked.
 * An x does not represent passage of time. For example a marble diagram of x-xx-x represents execution at:
 * 0s, 1s, 1s, 2s
 *
 * @param clock
 * @param wrapCallback
 */
export function createCallbackTimingTest(
    clock: MockTime,
    wrapCallback: (inner: () => void) => () => void
): (input: string) => Promise<string> {
    return marbleTest<{
        spy: Spy
        throttled: () => void
        out: string
    }>(
        () => {
            clock.mockDate(new Date(0))
            let _out = ''
            let lastTimeMs = 0
            const writeTime = () => {
                const nowMs = Date.now()
                _out += '-'.repeat((nowMs - lastTimeMs) / 1000)
                lastTimeMs = nowMs
            }
            const spy = createSpy('inner').and.callFake(() => {
                writeTime()
                _out += 'x'
            })
            const throttled = wrapCallback(spy)
            return {
                spy,
                throttled,
                get out() {
                    return _out
                },
            }
        },
        {
            '-': () => {
                return clock.tick(1)
            },
            x: (test) => {
                test.throttled()
            },
        },
        async (o) => {
            // Flush any pending timeouts up to 10s in the future, ticking in 1s increments
            // in order to get correct mock time resolution:
            for (let i = 0; i < 10; i++) {
                await clock.tick(1)
            }
            return o.out
        }
    )
}
