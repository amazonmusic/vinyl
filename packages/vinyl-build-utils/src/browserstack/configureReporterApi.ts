/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express } from 'express'
import { json as expressJson } from 'express'

export interface StartedRequest {
    /**
     * The identifier, provided in the url for the session.
     */
    readonly id: string

    /**
     * The total number of specs.
     */
    readonly totalSpecs: number
}

export interface ProgressRequest {
    /**
     * The identifier, provided in the url for the session.
     */
    readonly id: string

    /**
     * The number of specs completed.
     */
    readonly totalCompleted: number

    /**
     * The total number of specs.
     */
    readonly totalSpecs: number

    /**
     * The console logs.
     */
    readonly logs: readonly LogEntry[]
}

export type LogEntry = [
    level: 'debug' | 'log' | 'info' | 'warn' | 'error',

    /**
     * An iso 8601 date string.
     */
    dateStr: string,

    /**
     * The log message.
     */
    message: string,
]

export interface DoneRequest extends ProgressRequest {
    /**
     * Set session status to either passed or failed.
     */
    readonly overallStatus: 'passed' | 'failed' | 'incomplete'

    /**
     * Reason for session failure.
     */
    readonly reason?: string
}

/**
 * Callbacks for the REST API provided to the test reporter.
 */
export interface ReportingListener {
    /**
     * Return true if this listener handles the given request id.
     * If the BrowserStack runner is restarted, workers from the previous session may invoke the listener for the new
     * session. Return false to ignore the orphaned testing session.
     *
     * @param id
     */
    shouldHandleRequest(id: string): boolean

    /**
     * The suite has begun. Provides the total number of specs.
     * @param request
     */
    onStarted(request: StartedRequest): void

    /**
     * One spec has completed.
     */
    onProgress(request: ProgressRequest): void

    /**
     * The suite has finished.
     */
    onDone(request: DoneRequest): void
}

/**
 * Creates a REST API the test reporter can use to notify the browserstack runner of current progress.
 * See Vinyl's `test/browserTestUtil/reporters/RestApiReporter.ts`
 *
 * @param app The Express application.
 * @param listener Callbacks invoked when the API endpoints are called.
 */
export function configureReportingApi(
    app: Express,
    listener: ReportingListener
) {
    app.use(expressJson({ limit: '10mb' }))

    app.post('/report/:id/started', (req, res) => {
        if (listener.shouldHandleRequest(req.params.id)) {
            listener.onStarted({
                id: req.params.id,
                totalSpecs: req.body.totalSpecs,
            })
            res.status(200).send({ ok: true })
        } else {
            res.status(400).send({ ok: false })
        }
    })

    app.post('/report/:id/progress', (req, res) => {
        if (listener.shouldHandleRequest(req.params.id)) {
            listener.onProgress({
                id: req.params.id,
                ...req.body,
            })

            res.status(200).send({ ok: true })
        } else {
            res.status(400).send({ ok: false })
        }
    })

    app.post('/report/:id/done', (req, res) => {
        if (listener.shouldHandleRequest(req.params.id)) {
            listener.onDone({
                id: req.params.id,
                ...req.body,
            })
            res.status(200).send({ ok: true })
        } else {
            res.status(400).send({ ok: false })
        }
    })
}
