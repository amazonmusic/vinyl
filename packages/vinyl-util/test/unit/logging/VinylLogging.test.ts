/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    consoleLogHandler,
    getLogLevelFromSearch,
    historyLogHandler,
    initializeLogging,
    logDebug,
    loggerRef,
    LogLevel,
    type LogTarget,
} from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'

describe('VinylLogging', () => {
    const target = {
        logPrefix: 'logPrefix1',
    } as const satisfies LogTarget

    describe('getLogLevelFromSearch', () => {
        it('uses the vinylLogLevel querystring', () => {
            expect(getLogLevelFromSearch('?vinylLogLevel=warn')).toBe(
                LogLevel.WARN
            )
        })

        it('uses the default if no match', () => {
            expect(getLogLevelFromSearch('')).toBe(LogLevel.WARN)
            expect(getLogLevelFromSearch('', LogLevel.ERROR)).toBe(
                LogLevel.ERROR
            )
            expect(
                getLogLevelFromSearch('?vinylLogLevel=unknown', LogLevel.ERROR)
            ).toBe(LogLevel.ERROR)
        })
    })

    describe('historyLogHandlerInit', () => {
        const clock = useMockTime() // So dates are deterministic
        beforeEach(() => {
            historyLogHandler.initialize()
        })

        it('initializes a history log handler', () => {
            logDebug(target, 'test 1')
            void clock.tick(10)
            logDebug(target, 'test 2')
            void clock.tick(20)
            logDebug(target, 'test 3')
            expect(historyLogHandler.value?.history).toEqual([
                {
                    level: LogLevel.DEBUG,
                    messages: ['test 1'],
                    timestamp: new Date(0),
                    logPrefix: 'logPrefix1',
                },
                {
                    level: LogLevel.DEBUG,
                    messages: ['test 2'],
                    timestamp: new Date(10_000),
                    logPrefix: 'logPrefix1',
                },
                {
                    level: LogLevel.DEBUG,
                    messages: ['test 3'],
                    timestamp: new Date(30_000),
                    logPrefix: 'logPrefix1',
                },
            ])
        })
    })

    describe('initializeLogging', () => {
        it('initializes history and log handler', () => {
            expect(loggerRef.value.hasAnyListeners()).toBeFalse()
            initializeLogging()
            expect(loggerRef.value.hasAnyListeners()).toBeTrue()
            expect(historyLogHandler.initialized).toBeTrue()
            expect(consoleLogHandler.initialized).toBeTrue()
        })
    })
})
