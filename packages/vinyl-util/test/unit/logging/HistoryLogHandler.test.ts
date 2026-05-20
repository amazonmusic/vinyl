/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    DEFAULT_MAX_HISTORY,
    HistoryLogHandlerImpl,
    type Logger,
    LoggerImpl,
    LogLevel,
    type LogTarget,
} from '@amazon/vinyl-util'
import anything = jasmine.anything
import objectContaining = jasmine.objectContaining

describe('HistoryLogHandlerImpl', () => {
    const target: LogTarget = {
        logPrefix: 'path',
    }
    let logger: Logger

    beforeEach(() => {
        logger = new LoggerImpl()
    })

    describe('constructor', () => {
        it('constructs a new HistoryLogHandler with the default history size', () => {
            expect(new HistoryLogHandlerImpl(logger).maxHistorySize).toBe(
                DEFAULT_MAX_HISTORY
            )
        })
    })

    it('creates a history item per log message', () => {
        const handler = new HistoryLogHandlerImpl(logger, LogLevel.DEBUG)
        handler.maxHistorySize = 5
        const history = handler.history
        logger.log(target, LogLevel.DEBUG, 'debug1')
        expect(history).toEqual([
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug1'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
        ])
        logger.log(target, LogLevel.WARN, 'warn1')
        logger.log(target, LogLevel.INFO, 'info1')
        expect(history).toEqual([
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug1'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
            objectContaining({
                level: LogLevel.WARN,
                messages: ['warn1'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
            objectContaining({
                level: LogLevel.INFO,
                messages: ['info1'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
        ])
    })

    it('removes oldest after history size has been met', () => {
        const handler = new HistoryLogHandlerImpl(logger, LogLevel.DEBUG)
        handler.maxHistorySize = 5
        const history = handler.history
        logger.log(target, LogLevel.DEBUG, 'debug1')
        logger.log(target, LogLevel.DEBUG, 'debug2')
        logger.log(target, LogLevel.DEBUG, 'debug3')
        logger.log(target, LogLevel.DEBUG, 'debug4')
        logger.log(target, LogLevel.DEBUG, 'debug5')
        logger.log(target, LogLevel.DEBUG, 'debug6')
        expect(history).toEqual([
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug2'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug3'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug4'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug5'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
            objectContaining({
                level: LogLevel.DEBUG,
                messages: ['debug6'],
                timestamp: anything(),
                logPrefix: target.logPrefix,
            }),
        ])
    })

    describe('dispose', () => {
        it('removes the log handler and clears the history', () => {
            const historyHandler = new HistoryLogHandlerImpl(
                logger,
                LogLevel.DEBUG
            )
            historyHandler.maxHistorySize = 5
            logger.log(target, LogLevel.DEBUG, 'debug1')
            historyHandler.dispose()
            logger.log(target, LogLevel.DEBUG, 'debug2')
            logger.log(target, LogLevel.DEBUG, 'debug3')
            logger.log(target, LogLevel.DEBUG, 'debug4')
            expect(historyHandler.history.length).toBe(0)
        })
    })

    describe('maxHistorySize', () => {
        describe('when set', () => {
            it('removes oldest logs if current logs exceed new size', () => {
                const historyHandler = new HistoryLogHandlerImpl(
                    logger,
                    LogLevel.DEBUG
                )
                expect(historyHandler.maxHistorySize).toBe(DEFAULT_MAX_HISTORY)
                logger.log(target, LogLevel.DEBUG, 'debug1')
                logger.log(target, LogLevel.DEBUG, 'debug2')
                logger.log(target, LogLevel.DEBUG, 'debug3')
                logger.log(target, LogLevel.DEBUG, 'debug4')
                logger.log(target, LogLevel.DEBUG, 'debug5')
                logger.log(target, LogLevel.DEBUG, 'debug6')
                historyHandler.maxHistorySize = 3
                expect(historyHandler.history).toEqual([
                    objectContaining({
                        messages: ['debug4'],
                    }),
                    objectContaining({
                        messages: ['debug5'],
                    }),
                    objectContaining({
                        messages: ['debug6'],
                    }),
                ])
                historyHandler.maxHistorySize = -1
                expect(historyHandler.maxHistorySize).toBe(0)
                expect(historyHandler.history).toEqual([])
            })
        })
    })

    describe('logLevel', () => {
        it('filters logs with a lower level', () => {
            const historyHandler = new HistoryLogHandlerImpl(
                logger,
                LogLevel.DEBUG
            )
            historyHandler.maxHistorySize = 5
            historyHandler.logLevel = LogLevel.WARN
            logger.log(target, LogLevel.DEBUG, 'debug1')
            logger.log(target, LogLevel.WARN, 'debug2')
            logger.log(target, LogLevel.ERROR, 'debug3')
            logger.log(target, LogLevel.DEBUG, 'debug4')
            logger.log(target, LogLevel.INFO, 'debug4')
            expect(historyHandler.history.length).toBe(2)
        })
    })
})
