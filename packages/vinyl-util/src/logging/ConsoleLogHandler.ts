/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@/core/disposable'
import type { ReadonlyEventHost } from '@/event/EventHost'
import type { Unsubscribe } from '@/core/Unsubscribe'
import type { LogEventMap } from './Logger'
import { LogLevel } from './Logger'

export interface ConsoleLike {
    log(message?: any, ...optionalParams: any[]): void
    debug(message?: any, ...optionalParams: any[]): void
    warn(message?: any, ...optionalParams: any[]): void
    error(message?: any, ...optionalParams: any[]): void
}

/**
 * A log target that logs to a console.
 */
export interface ConsoleLogHandler {
    logLevel: LogLevel
}

/**
 * A {@link ConsoleLogHandler} implementation.
 */
export class ConsoleLogHandlerImpl implements ConsoleLogHandler, Disposable {
    private readonly logSub: Unsubscribe

    constructor(
        host: ReadonlyEventHost<LogEventMap>,
        public logLevel: LogLevel = LogLevel.DEBUG,
        consoleLike: ConsoleLike = console
    ) {
        this.logSub = host.on('log', (event) => {
            if (event.level < this.logLevel) return
            let consoleFun: (message?: any, ...optionalParams: any[]) => void
            switch (event.level) {
                case LogLevel.INFO:
                    consoleFun = consoleLike['log']
                    break
                case LogLevel.WARN:
                    consoleFun = consoleLike['warn']
                    break
                case LogLevel.ERROR:
                    consoleFun = consoleLike['error']
                    break
                case LogLevel.DEBUG:
                case LogLevel.VERBOSE:
                default:
                    consoleFun = consoleLike['debug']
                    break
            }
            const now = new Date()
            const minutes = String(now.getMinutes()).padStart(2, '0')
            const seconds = String(now.getSeconds()).padStart(2, '0')
            consoleFun.call(
                consoleLike,
                `[${minutes}:${seconds} ${event.target.logPrefix}]`,
                ...event.messages
            )
        })
    }

    dispose(): void {
        this.logSub()
    }
}
