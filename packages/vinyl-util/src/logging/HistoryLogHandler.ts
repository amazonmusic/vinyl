/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@/core/disposable'
import type { ReadonlyEventHost } from '@/event/EventHost'
import type { Unsubscribe } from '@/core/Unsubscribe'
import type { LogEventMap } from './Logger'
import { LogLevel } from './Logger'
import type { ReadonlyDate } from '@/util/object/readonlyType'

/**
 * The default maximum history size for the history log handler.
 */
export const DEFAULT_MAX_HISTORY = 100

export interface HistoryLogItem {
    readonly timestamp: ReadonlyDate
    readonly messages: readonly any[]
    readonly level: LogLevel

    /**
     * The LogTarget's logPrefix.
     */
    readonly logPrefix: string
}

/**
 * Logs to a rolling list.
 */
export interface HistoryLogHandler {
    /**
     * This level and higher will be logged to the history.
     * Default is {@link LogLevel.DEBUG}
     */
    logLevel: LogLevel

    /**
     * The maximum number of logs to keep.
     */
    maxHistorySize: number

    /**
     * The log history, kept up to {@link maxHistorySize}
     */
    get history(): readonly HistoryLogItem[]

    /**
     * Clears the log history.
     */
    clear(): void
}

/**
 * A basic HistoryLogHandler implementation.
 */
export class HistoryLogHandlerImpl implements HistoryLogHandler, Disposable {
    private readonly _history: HistoryLogItem[] = []
    private readonly logSub: Unsubscribe
    private _maxHistorySize: number = DEFAULT_MAX_HISTORY

    constructor(
        host: ReadonlyEventHost<LogEventMap>,
        public logLevel: LogLevel = LogLevel.DEBUG
    ) {
        this.logSub = host.on('log', (event) => {
            if (event.level < this.logLevel) return
            this._history.push({
                level: event.level,
                messages: event.messages,
                timestamp: new Date(),
                logPrefix: event.target.logPrefix,
            })
            if (this._history.length > this.maxHistorySize) {
                this._history.shift()
            }
        })
    }

    get maxHistorySize(): number {
        return this._maxHistorySize
    }

    set maxHistorySize(value: number) {
        value = Math.max(0, value)
        while (value < this._history.length) {
            this._history.shift()
        }
        this._maxHistorySize = value
    }

    get history(): readonly HistoryLogItem[] {
        return this._history
    }

    clear() {
        this._history.length = 0
    }

    dispose(): void {
        this.clear()
        this.logSub()
    }
}
