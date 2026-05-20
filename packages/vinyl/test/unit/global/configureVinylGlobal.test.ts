/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlayerRegistryImpl } from '@amazon/vinyl'
import { configureVinylGlobal, playerRegistryRef } from '@amazon/vinyl'
import {
    consoleLogHandler,
    historyLogHandler,
    LogLevel,
} from '@amazon/vinyl-util'
import { overrideGlobalInit, useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('configureVinylGlobal', () => {
    describe('when logging is defined', () => {
        describe('when logLevel is defined', () => {
            const loggingRef = useMockLogger()
            it('sets log level', () => {
                configureVinylGlobal({
                    logging: {
                        logLevel: LogLevel.WARN,
                    },
                })
                expect(loggingRef.value.logLevel).toEqual(LogLevel.WARN)
                configureVinylGlobal({
                    logging: {
                        logLevel: LogLevel.DEBUG,
                    },
                })
                expect(loggingRef.value.logLevel).toEqual(LogLevel.DEBUG)
            })

            it('validates log level', () => {
                expect(() =>
                    configureVinylGlobal({
                        logging: {
                            // @ts-expect-error Not a valid log level
                            logLevel: 99,
                        },
                    })
                ).toThrowError(
                    'Expected: one of: 0 | 1 | 2 | 3 | 4 | 5, but was: 99. At: logging.logLevel'
                )
            })
        })

        describe('and logging.history is defined', () => {
            describe('and historyLogHandler.value is defined', () => {
                describe('and logging.history.maxHistorySize is defined', () => {
                    it('changes max history size', () => {
                        configureVinylGlobal({
                            logging: {
                                history: {
                                    maxHistorySize: 10,
                                },
                            },
                        })
                        expect(historyLogHandler.value?.maxHistorySize).toEqual(
                            10
                        )
                    })

                    it('validates max history size to be a number', () => {
                        expect(() =>
                            configureVinylGlobal({
                                logging: {
                                    history: {
                                        // @ts-expect-error Not valid, should be type number
                                        maxHistorySize: '10',
                                    },
                                },
                            })
                        ).toThrowError(
                            'Expected: type number, but was: "10". At: logging.history.maxHistorySize'
                        )
                    })
                })

                describe('and logging.history.logLevel is defined', () => {
                    it('changes the history log handler logLevel', () => {
                        configureVinylGlobal({
                            logging: {
                                history: {
                                    logLevel: LogLevel.WARN,
                                },
                            },
                        })
                        expect(historyLogHandler.value?.logLevel).toEqual(
                            LogLevel.WARN
                        )
                        configureVinylGlobal({
                            logging: {
                                history: {
                                    logLevel: LogLevel.DEBUG,
                                },
                            },
                        })
                        expect(historyLogHandler.value?.logLevel).toEqual(
                            LogLevel.DEBUG
                        )
                    })
                })
            })

            describe('and historyLogHandler.value is not defined', () => {
                overrideGlobalInit(historyLogHandler, () => undefined)

                it('does nothing', () => {
                    expect(() =>
                        configureVinylGlobal({
                            logging: {
                                history: {
                                    maxHistorySize: 10,
                                    logLevel: LogLevel.WARN,
                                },
                            },
                        })
                    ).not.toThrow()
                })
            })
        })

        describe('and logging.console is defined', () => {
            describe('and consoleLogHandler is defined', () => {
                it('changes the console log handler logLevel', () => {
                    configureVinylGlobal({
                        logging: {
                            console: {
                                logLevel: LogLevel.WARN,
                            },
                        },
                    })
                    expect(consoleLogHandler.value?.logLevel).toEqual(
                        LogLevel.WARN
                    )
                    configureVinylGlobal({
                        logging: {
                            console: {
                                logLevel: LogLevel.DEBUG,
                            },
                        },
                    })
                    expect(consoleLogHandler.value?.logLevel).toEqual(
                        LogLevel.DEBUG
                    )
                })
            })

            describe('and consoleLogHandler is not defined', () => {
                overrideGlobalInit(consoleLogHandler, () => undefined)

                it('does nothing', () => {
                    expect(() =>
                        configureVinylGlobal({
                            logging: {
                                console: {
                                    logLevel: LogLevel.WARN,
                                },
                            },
                        })
                    ).not.toThrow()
                })
            })
        })
    })

    describe('when maxPlayersWarning is defined', () => {
        describe('and playerRegistry is an instance of PlayerRegistryImpl', () => {
            it('sets playerRegistry maxPlayersWarning', () => {
                configureVinylGlobal({
                    maxPlayersWarning: 11,
                })
                expect(
                    (playerRegistryRef.value as PlayerRegistryImpl)
                        .maxPlayersWarning
                ).toEqual(11)
            })
        })

        describe('and playerRegistry is not an instance of PlayerRegistryImpl', () => {
            const overriddenPlayerRegistry = overrideGlobalInit(
                playerRegistryRef,
                () => {
                    return {
                        players: [],
                        addPlayer() {},
                        removePlayer() {},
                    }
                }
            )
            it('does nothing', () => {
                configureVinylGlobal({
                    maxPlayersWarning: 11,
                })
                expect(
                    (overriddenPlayerRegistry.value as any).maxPlayersWarning
                ).toBeUndefined()
            })
        })
    })
})
