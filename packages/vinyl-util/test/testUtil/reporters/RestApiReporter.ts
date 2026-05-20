/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type LogReporterProgressEvent,
    LogReporter,
    type LogReporterDoneEvent,
    type LogReporterStartedEvent,
} from '@/reporters/LogReporter'
import { initializeUncaughtErrorLogging } from '@/util/initializeUncaughtErrorLogging'
import { stringifyLogLevel } from '@amazon/vinyl-util'

export class RestApiReporter extends LogReporter {
    /**
     * Installs this reporter if this is a Browser environment and the report api has been provided as a query
     * parameter.
     * @param searchParam
     */
    static installFromSearchParam(searchParam: string = 'reportApi') {
        if (typeof location === 'undefined') return
        const url = new URL('about:blank')
        url.search = location.search
        // Uses `URL.searchParams` over `new URLSearchParams`; URLSearchParams constructor is not
        // as widely supported.
        const reportApi = url.searchParams.get(searchParam)
        if (reportApi) {
            jasmine.getEnv().addReporter(new RestApiReporter(reportApi))
            initializeUncaughtErrorLogging()
        }
    }

    constructor(private readonly reportApi: string) {
        super()
    }

    protected onStarted(action: LogReporterStartedEvent): Promise<void> {
        return this.doRequest('started', action)
    }

    protected onProgress(action: LogReporterProgressEvent): Promise<void> {
        return this.doRequest('progress', {
            totalCompleted: action.totalCompleted,
            totalSpecs: action.totalSpecs,
            logs: action.logs.map((logEntry) => [
                stringifyLogLevel(logEntry.level),
                logEntry.timestamp.toISOString(),
                logArgsToStr(logEntry.messages),
            ]),
        })
    }

    protected onDone(action: LogReporterDoneEvent): Promise<void> {
        return this.doRequest('done', action)
    }

    /**
     * If the reportApi url was set in the URL parameters, report to that URL the test progress.
     *
     * @param action One of: 'started', 'progress', or 'done'
     * @param body
     * @private
     */
    private async doRequest(
        action: 'started' | 'progress' | 'done',
        body: any
    ): Promise<void> {
        if (!this.reportApi) return
        const response = await fetch(`${this.reportApi}/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        if (!response.ok)
            throw new Error(`${response.status} Error: ${response.statusText}`)
        return await response.json()
    }
}

/**
 * Converts the arguments to console logging to a string.
 * @param args
 */
function logArgsToStr(args: readonly any[]): string {
    return args
        .map((arg) => {
            if (arg != null && typeof arg === 'object') {
                try {
                    return JSON.stringify(arg)
                } catch (_) {
                    return String(arg)
                }
            } else {
                return String(arg)
            }
        })
        .join(' ')
}
