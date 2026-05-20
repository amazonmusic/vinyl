/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ConsoleLogHandlerImpl,
    type Logger,
    LoggerImpl,
    LogLevel,
    type LogTarget,
} from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

function createConsoleLike() {
    return {
        debug: createSpy('debug'),
        error: createSpy('error'),
        log: createSpy('log'),
        warn: createSpy('warn'),

        resetAll() {
            this.debug.calls.reset()
            this.error.calls.reset()
            this.log.calls.reset()
            this.warn.calls.reset()
        },
    } as const
}

describe('ConsoleLogHandler', () => {
    const target: LogTarget = {
        logPrefix: 'path',
    }
    let logger: Logger
    const mockTime = useMockTime()

    beforeEach(() => {
        logger = new LoggerImpl(LogLevel.VERBOSE)
        mockTime.mockDate(new Date(2024, 3, 1, 23, 14, 32))
    })

    describe('constructor', () => {
        it('constructs a new ConsoleLogHandlerImpl using the global console', () => {
            expect(new ConsoleLogHandlerImpl(logger)).toBeDefined()
        })
    })

    it('invokes console methods corresponding to log level', () => {
        const consoleLike = createConsoleLike()
        new ConsoleLogHandlerImpl(logger, LogLevel.VERBOSE, consoleLike)
        logger.log(target, LogLevel.DEBUG, 'debug1')
        expect(consoleLike.debug).toHaveBeenCalledOnceWith(
            `[14:32 ${target.logPrefix}]`,
            'debug1'
        )
        logger.log(target, LogLevel.INFO, 'info1')
        expect(consoleLike.log).toHaveBeenCalledOnceWith(
            `[14:32 ${target.logPrefix}]`,
            'info1'
        )
        logger.log(target, LogLevel.WARN, 'warn1')
        expect(consoleLike.warn).toHaveBeenCalledOnceWith(
            `[14:32 ${target.logPrefix}]`,
            'warn1'
        )
        logger.log(target, LogLevel.ERROR, 'error1')
        expect(consoleLike.error).toHaveBeenCalledOnceWith(
            `[14:32 ${target.logPrefix}]`,
            'error1'
        )

        consoleLike.debug.calls.reset()
        logger.log(target, LogLevel.VERBOSE, 'verbose1')
        expect(consoleLike.debug).toHaveBeenCalledOnceWith(
            `[14:32 ${target.logPrefix}]`,
            'verbose1'
        )
    })

    it('ignores logs lesser than the set level', () => {
        const consoleLike = createConsoleLike()
        const handler = new ConsoleLogHandlerImpl(
            logger,
            LogLevel.DEBUG,
            consoleLike
        )
        handler.logLevel = LogLevel.INFO
        logger.log(target, LogLevel.DEBUG, 'debug')
        expect(consoleLike.debug).not.toHaveBeenCalled()
        logger.log(target, LogLevel.INFO, 'info')
        expect(consoleLike.log.calls.count()).toBe(1)
        consoleLike.resetAll()
        handler.logLevel = LogLevel.WARN
        logger.log(target, LogLevel.INFO, 'info')
        expect(consoleLike.log).not.toHaveBeenCalled()
        logger.log(target, LogLevel.WARN, 'warn')
        expect(consoleLike.warn.calls.count()).toBe(1)
        logger.log(target, LogLevel.ERROR, 'error')
        expect(consoleLike.error.calls.count()).toBe(1)
        consoleLike.resetAll()
        handler.logLevel = LogLevel.ERROR
        logger.log(target, LogLevel.ERROR, 'error')
        expect(consoleLike.error.calls.count()).toBe(1)
        logger.log(target, LogLevel.WARN, 'warn')
        expect(consoleLike.warn).not.toHaveBeenCalled()
        logger.log(target, LogLevel.INFO, 'info')
        expect(consoleLike.log).not.toHaveBeenCalled()
        logger.log(target, LogLevel.DEBUG, 'debug')
        expect(consoleLike.debug).not.toHaveBeenCalled()
    })

    describe('dispose', () => {
        it('removes the log handler', () => {
            const consoleLike = createConsoleLike()
            const handler = new ConsoleLogHandlerImpl(
                logger,
                LogLevel.DEBUG,
                consoleLike
            )
            logger.log(target, LogLevel.DEBUG, 'debug1')
            expect(consoleLike.debug).toHaveBeenCalledOnceWith(
                `[14:32 ${target.logPrefix}]`,
                'debug1'
            )
            consoleLike.resetAll()
            handler.dispose()
            logger.log(target, LogLevel.DEBUG, 'debug2')
            expect(consoleLike.debug.calls.count()).toEqual(0)
        })
    })
})
