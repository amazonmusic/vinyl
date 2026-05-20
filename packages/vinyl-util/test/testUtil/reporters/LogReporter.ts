/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import CustomReporter = jasmine.CustomReporter
import JasmineDoneInfo = jasmine.JasmineDoneInfo
import JasmineStartedInfo = jasmine.JasmineStartedInfo
import SpecResult = jasmine.SpecResult
import { LogLevel, type ReadonlyDate } from '@amazon/vinyl-util'

/**
 * The minimum number of seconds between progress reports.
 */
const UPDATE_INTERVAL = 1

/**
 * The maximum number of log statements before forcing a flush.
 * This can be reached if a single test is long-running and has excessive logs.
 */
const MAX_LOGS_BUFFER = 200

export interface LogReporterStartedEvent {
    readonly totalSpecs: number
}

export interface LogReporterProgressEvent {
    readonly totalCompleted: number
    readonly totalSpecs: number
    readonly logs: readonly LogEntry[]
}

export interface LogReporterDoneEvent {
    readonly overallStatus: 'passed' | 'failed'
    readonly totalCompleted: number
    readonly totalSpecs: number
    readonly reason: string
}

export interface LogEntry {
    readonly timestamp: ReadonlyDate
    readonly messages: readonly any[]
    readonly level: LogLevel
}

export abstract class LogReporter implements CustomReporter {
    /**
     * The first failed spec.
     *
     * Jasmine's spec result in `jasmineDone` does not provide these correctly in
     * failedExpectations, save this from `specDone`.
     */
    private failedResult: SpecResult | null = null

    private totalSpecs = 0
    private totalCompleted = 0

    /**
     * The timestamp of the last progress update.
     */
    protected lastProgressTimestamp = 0
    protected updateInterval = UPDATE_INTERVAL
    protected maxLogsBuffer = MAX_LOGS_BUFFER

    private consoleInterceptor = new ConsoleInterceptor()

    private readonly logs: LogEntry[] = []

    protected constructor() {
        this.consoleInterceptor.onLog = (entry) => {
            this.logs.push(entry)
            if (this.logs.length >= this.maxLogsBuffer)
                this.maybeReportProgress(true)
        }
    }

    jasmineStarted(suiteInfo: JasmineStartedInfo): void {
        this.onStarted({
            totalSpecs: suiteInfo.totalSpecsDefined,
        }).catch((e) => {
            console.error(`'done' failed to report`, e)
        })
        this.totalCompleted = 0
        this.totalSpecs = suiteInfo.totalSpecsDefined
    }

    protected abstract onStarted(action: LogReporterStartedEvent): Promise<void>

    specDone(result: SpecResult): void {
        if (!this.failedResult && result.status === 'failed')
            this.failedResult = result
        this.totalCompleted++
        this.maybeReportProgress()
    }

    jasmineDone(runDetails: JasmineDoneInfo): void {
        this.maybeReportProgress(true)
        this.consoleInterceptor.dispose()
        const reason = this.failedResult
            ? `${this.failedResult.fullName}:\n${this.failedResult.failedExpectations[0]?.message}`
            : runDetails.overallStatus === 'incomplete'
              ? runDetails.incompleteReason
              : ''
        const body: LogReporterDoneEvent = {
            // one of: 'passed', 'failed', 'incomplete'
            overallStatus:
                runDetails.overallStatus === 'incomplete'
                    ? 'passed'
                    : (runDetails.overallStatus as 'passed' | 'failed'),
            totalCompleted: this.totalCompleted,
            totalSpecs: this.totalSpecs,
            reason,
        }
        this.onDone(body).catch((_) => {
            // One retry:
            this.onDone(body).catch((e) => {
                console.error(`'done' failed to report`, e)
            })
        })
    }

    /**
     * If there has not been a progress update within `updateInterval`, emit another progress
     * event.
     * @private
     */
    private maybeReportProgress(force: boolean = false) {
        const now = Date.now()
        if (
            force ||
            now - this.lastProgressTimestamp > this.updateInterval * 1000
        ) {
            const logs = this.logs.slice()
            this.logs.length = 0
            this.onProgress({
                totalCompleted: this.totalCompleted,
                totalSpecs: this.totalSpecs,
                logs,
            }).catch((e) => {
                console.error(`'progress' failed to report`, e)
            })
            this.lastProgressTimestamp = now
        }
    }

    protected abstract onProgress(
        action: LogReporterProgressEvent
    ): Promise<void>

    protected abstract onDone(action: LogReporterDoneEvent): Promise<void>
}

const consoleMethods = [
    'debug',
    'log',
    'info',
    'warn',
    'error',
] as const satisfies (keyof Console)[]

const consoleMethodLevels: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    log: LogLevel.DEBUG,
    warn: LogLevel.WARN,
    info: LogLevel.INFO,
    error: LogLevel.ERROR,
} as const

/**
 * Intercepts console, logging to an array as well.
 */
class ConsoleInterceptor {
    private readonly originalMethods: Record<string, (...args: any[]) => void>

    /**
     * Invoked on every log statement.
     */
    onLog: ((entry: LogEntry) => void) | null = null

    constructor() {
        this.originalMethods = {}
        for (const consoleMethod of consoleMethods) {
            this.originalMethods[consoleMethod] = console[consoleMethod]
            console[consoleMethod] = (...args) => {
                if (this.onLog)
                    this.onLog({
                        level:
                            consoleMethodLevels[consoleMethod] ??
                            LogLevel.DEBUG,
                        timestamp: new Date(),
                        messages: args,
                    })
                this.originalMethods[consoleMethod].apply(console, args)
            }
        }
    }

    dispose() {
        for (const consoleMethod of consoleMethods) {
            console[consoleMethod] = this.originalMethods[consoleMethod]
        }
    }
}
