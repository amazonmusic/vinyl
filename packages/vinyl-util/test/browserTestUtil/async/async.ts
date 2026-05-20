/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Clock = jasmine.Clock

/**
 * Fixed to setTimeout before any mocks can take place.
 */
const scheduler = setTimeout

/**
 * Returns a promise, when awaited, will ensure that all promise handlers are invoked.
 */
export function flushPromises(): Promise<void> {
    return new Promise((resolve) => {
        scheduler(() => resolve(void 0))
    })
}

export interface MockTime {
    /**
     * Ticks forward `time` seconds, incrementally for each time argument.
     * After each time increment, promises will be flushed.
     * If no time values are provided, {@link flushPromises}, time will not be incremented, but
     * will still be called.
     *
     * @param time (in seconds)
     * @return Returns a promise which resolves after the last time increment and promise flush.
     */
    tick(...time: number[]): Promise<void>

    /**
     * Sets the current date to the given date.
     *
     * @param date
     */
    mockDate(date?: Date): void
}

/**
 * Call within a `describe` block to install jasmine's mock clock between tests.
 * The returned object has one difference from jasmine's Clock tick and setTime; a promise is
 * returned, which when awaited, will ensure that promise handlers based on timed events will be
 * called in the order in which they were intended.
 */
export function useMockTime(): MockTime {
    const clock: Clock = jasmine.clock()

    beforeEach(() => {
        clock.install()
        clock.mockDate(new Date(0))
    })

    afterEach(() => {
        clock.uninstall()
    })

    const mockTime: MockTime = {
        async tick(...time: readonly number[]): Promise<void> {
            if (!time.length) {
                clock.tick(0)
                await flushPromises()
            }
            for (const s of time) {
                clock.tick(s * 1000)
                await flushPromises()
            }
        },

        mockDate(date?: Date): void {
            clock.mockDate(date)
        },
    } as const
    return mockTime
}
