/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyEventHost } from '../event/EventHost'
import { EventHostImpl } from '../event/EventHost'
import { globalRef } from '../global/globalRegistry'
import { toJson } from '../util/serialization/json'
import type { LogTarget } from './LogTarget'
import { getLogLevelFromSearch } from './getLogLevelFromSearch'

export enum LogLevel {
    VERBOSE,
    DEBUG,
    INFO,
    WARN,
    ERROR,
    NONE,
}

export interface LogEvent {
    readonly messages: any[]
    readonly target: LogTarget
    readonly level: LogLevel
}

export interface LogEventMap {
    readonly log: LogEvent
}

/**
 * The interface for a basic logger implementation.
 */
export interface Logger extends ReadonlyEventHost<LogEventMap> {
    logLevel: LogLevel

    log(target: LogTarget, level: LogLevel, ...messages: readonly any[]): void
}

export class LoggerImpl extends EventHostImpl<LogEventMap> implements Logger {
    get [Symbol.toStringTag](): string {
        return 'Logger'
    }

    constructor(public logLevel: LogLevel = LogLevel.DEBUG) {
        super()
    }

    log(target: LogTarget, level: LogLevel, ...messages: readonly any[]): void {
        if (level === LogLevel.NONE || level < this.logLevel) return
        this.dispatch('log', {
            level,
            messages: toJson(messages),
            target,
        })
    }
}

/**
 * A global reference to the logger.
 * @private
 */
export const loggerRef = globalRef<Logger>(
    () =>
        new LoggerImpl(
            // The logger is initialized to VERBOSE if vinylLogLevel=verbose is in the query string
            // Otherwise use DEBUG.
            getLogLevelFromSearch() === LogLevel.VERBOSE
                ? LogLevel.VERBOSE
                : LogLevel.DEBUG
        )
)

/**
 * Returns the current log level.
 */
export function getLogLevel(): LogLevel {
    return loggerRef.value.logLevel
}

/**
 * Sets the current log level.
 *
 * @param value
 */
export function setLogLevel(value: LogLevel): void {
    loggerRef.value.logLevel = value
}

export function log(
    target: LogTarget,
    level: LogLevel,
    ...messages: readonly any[]
): void {
    loggerRef.value.log(target, level, ...messages)
}

export function logVerbose(
    target: LogTarget,
    ...messages: readonly any[]
): void {
    loggerRef.value.log(target, LogLevel.VERBOSE, ...messages)
}

export function logDebug(target: LogTarget, ...messages: readonly any[]): void {
    loggerRef.value.log(target, LogLevel.DEBUG, ...messages)
}

export function logInfo(target: LogTarget, ...messages: readonly any[]): void {
    loggerRef.value.log(target, LogLevel.INFO, ...messages)
}

export function logWarn(target: LogTarget, ...messages: readonly any[]): void {
    loggerRef.value.log(target, LogLevel.WARN, ...messages)
}

export function logError(target: LogTarget, ...messages: readonly any[]): void {
    loggerRef.value.log(target, LogLevel.ERROR, ...messages)
}

const strToLogLevel: Record<string, LogLevel> = {
    verbose: LogLevel.VERBOSE,
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
    none: LogLevel.NONE,
} as const

/**
 * From a case-insensitive string, returns the log level.
 * Possible values match to the keys in {@link LogLevel}.
 *
 * @param str
 */
export function parseLogLevel(str: string): LogLevel | null {
    return strToLogLevel[str.toLowerCase()] ?? null
}

const logLevelToString: Record<LogLevel, string> = {
    [LogLevel.VERBOSE]: 'verbose',
    [LogLevel.DEBUG]: 'debug',
    [LogLevel.INFO]: 'info',
    [LogLevel.WARN]: 'warn',
    [LogLevel.ERROR]: 'error',
    [LogLevel.NONE]: 'none',
} as const

/**
 * Returns the log level as a lowercase string.
 * E.g. stringifyLogLevel(LogLevel.DEBUG) returns 'debug'
 */
export function stringifyLogLevel(logLevel: LogLevel): string {
    return logLevelToString[logLevel]
}
