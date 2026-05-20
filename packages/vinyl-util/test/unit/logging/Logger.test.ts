/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getLogLevel,
    isNode,
    log,
    logDebug,
    logError,
    type LogEvent,
    type Logger,
    loggerRef,
    LoggerImpl,
    logInfo,
    LogLevel,
    type LogTarget,
    logVerbose,
    logWarn,
    parseLogLevel,
    setLogLevel,
    stringifyLogLevel,
} from '@amazon/vinyl-util'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'
import createSpy = jasmine.createSpy

describe('logging', () => {
    const target: LogTarget = {
        logPrefix: 'path',
    }

    describe('LoggerImpl', () => {
        let logger: Logger
        beforeEach(() => {
            logger = new LoggerImpl()
        })

        it('dispatches log events', () => {
            const cb = createSpy()
            logger.on('log', cb)
            logger.log(target, LogLevel.DEBUG, 'test1')
            const debugLogEvent: LogEvent = {
                level: LogLevel.DEBUG,
                messages: ['test1'],
                target,
            } as const
            expect(cb).toHaveBeenCalledOnceWith(debugLogEvent)
            cb.calls.reset()

            logger.log(target, LogLevel.ERROR, 'error1')
            const errorLogEvent: LogEvent = {
                level: LogLevel.ERROR,
                messages: ['error1'],
                target,
            } as const
            expect(cb).toHaveBeenCalledOnceWith(errorLogEvent)
            cb.calls.reset()

            logger.log(target, LogLevel.WARN, 'warn1')
            const warnLogEvent: LogEvent = {
                level: LogLevel.WARN,
                messages: ['warn1'],
                target,
            } as const
            expect(cb).toHaveBeenCalledOnceWith(warnLogEvent)
            cb.calls.reset()
        })

        it('does not dispatch log events for levels beneath logLevel', () => {
            logger.logLevel = LogLevel.WARN
            const cb = createSpy()
            logger.on('log', cb)
            logger.log(target, LogLevel.DEBUG, 'test1')
            expect(cb).not.toHaveBeenCalled()
            logger.log(target, LogLevel.WARN, 'test1')
            expect(cb).toHaveBeenCalledTimes(1)
        })
    })

    describe('log methods', () => {
        const target = {
            logPrefix: 'path',
        } as const satisfies LogTarget

        useMockLogger()
        describe('parseLogLevel', () => {
            it('parses a case-insensitive string into a LogLevel enum', () => {
                expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG)
                expect(parseLogLevel('Debug')).toBe(LogLevel.DEBUG)
                expect(parseLogLevel('info')).toBe(LogLevel.INFO)
                expect(parseLogLevel('warn')).toBe(LogLevel.WARN)
                expect(parseLogLevel('error')).toBe(LogLevel.ERROR)
                expect(parseLogLevel('none')).toBe(LogLevel.NONE)
                expect(parseLogLevel('unknown')).toBe(null)
            })
        })

        describe('stringifyLogLevel', () => {
            it('returns a lowercase string for the log level', () => {
                expect(stringifyLogLevel(LogLevel.DEBUG)).toBe('debug')
                expect(stringifyLogLevel(LogLevel.INFO)).toBe('info')
                expect(stringifyLogLevel(LogLevel.WARN)).toBe('warn')
                expect(stringifyLogLevel(LogLevel.ERROR)).toBe('error')
                expect(stringifyLogLevel(LogLevel.NONE)).toBe('none')
            })
        })

        describe('setLogLevel', () => {
            it('sets the current log level', () => {
                setLogLevel(LogLevel.WARN)
                expect(getLogLevel()).toBe(LogLevel.WARN)
                setLogLevel(LogLevel.NONE)
                expect(getLogLevel()).toBe(LogLevel.NONE)
            })
        })

        describe('log', () => {
            it('logs a message with the provided level', () => {
                log(target, LogLevel.ERROR, 1, 2, 3)
                expect(loggerRef.value.log).toHaveBeenCalledWith(
                    target,
                    LogLevel.ERROR,
                    1,
                    2,
                    3
                )
            })
        })

        describe('logVerbose', () => {
            it('logs a verbose message', () => {
                logVerbose(target, 1, 2, 3)
                expect(loggerRef.value.log).toHaveBeenCalledWith(
                    target,
                    LogLevel.VERBOSE,
                    1,
                    2,
                    3
                )
            })
        })

        describe('logDebug', () => {
            it('logs a debug message', () => {
                logDebug(target, 1, 2, 3)
                expect(loggerRef.value.log).toHaveBeenCalledWith(
                    target,
                    LogLevel.DEBUG,
                    1,
                    2,
                    3
                )
            })
        })

        describe('logInfo', () => {
            it('logs an info message', () => {
                logInfo(target, 1, 2, 3)
                expect(loggerRef.value.log).toHaveBeenCalledWith(
                    target,
                    LogLevel.INFO,
                    1,
                    2,
                    3
                )
            })
        })

        describe('logWarn', () => {
            it('logs a warn message', () => {
                logWarn(target, 1, 2, 3)
                expect(loggerRef.value.log).toHaveBeenCalledWith(
                    target,
                    LogLevel.WARN,
                    1,
                    2,
                    3
                )
            })
        })

        describe('logError', () => {
            it('logs an error message', () => {
                logError(target, 1, 2, 3)
                expect(loggerRef.value.log).toHaveBeenCalledWith(
                    target,
                    LogLevel.ERROR,
                    1,
                    2,
                    3
                )
            })
        })
    })

    describe('default log level', () => {
        afterEach(() => {
            if (isNode()) {
                delete (global as any).location
            }
        })

        describe('when vinylLogLevel=verbose is in the query string', () => {
            beforeEach(() => {
                if (!isNode()) {
                    pending('requires NODE to test')
                    return
                }
                ;(global as any).location = {
                    search: 'vinylLogLevel=verbose',
                }
            })

            it('initializes in VERBOSE mode', () => {
                expect(getLogLevel()).toBe(LogLevel.VERBOSE)
            })
        })

        describe('when vinylLogLevel=verbose is not in the query string', () => {
            beforeEach(() => {
                if (!isNode()) {
                    pending('requires NODE to test')
                    return
                }
                ;(global as any).location = {
                    search: '',
                }
            })

            it('initializes in DEBUG mode', () => {
                expect(getLogLevel()).toBe(LogLevel.DEBUG)
            })
        })
    })
})
