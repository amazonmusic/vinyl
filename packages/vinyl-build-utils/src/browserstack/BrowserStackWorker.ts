/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type BrowserStackAutomateClient,
    type SessionDetails,
    type WorkerOptions,
} from './browserStackRestApi'
import { TaskQueue } from '../util/TaskQueue'
import { logger } from '../util/Logger'
import type { LogEntry } from './configureReporterApi'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import Timeout = NodeJS.Timeout

/**
 * Local state for a single session/worker.
 */
export interface BrowserStackWorkerState {
    /**
     * A local identifier for the session, used to map reporter API calls to its respective worker session.
     */
    readonly localId: string

    /**
     * The browser worker configuration provided during construction.
     */
    readonly workerOptions: WorkerOptions

    /**
     * If non-null, indicates a fatal error.
     */
    error: Error | null

    /**
     * The session details, as retrieved from BrowserStack.
     */
    session: SessionDetails | null

    /**
     * True if the worker has started via {@link BrowserStackWorker.start}.
     * Once true, will not become false after termination.
     */
    started: boolean

    /**
     * True if the session is active.
     */
    active: boolean

    /**
     * The worker id.
     * When the session and worker have been created, this will be set.
     */
    workerId: number | null

    /**
     * The hashed session id.
     * When the session and worker have been created, this will be set.
     */
    sessionId: string | null

    /**
     * The total number of tests as reported by the test REST api.
     * This will be null until the value is received.
     */
    totalSpecs: number | null

    /**
     * The total number of specs completed, as reported by the test REST api.
     */
    totalCompleted: number

    /**
     * The number of retry attempts remaining.
     * A retry will happen if there has been a capture timeout, not if there has been a test failure.
     */
    attemptsRemaining: number
}

export type ReadonlyBrowserStackWorkerState = Readonly<BrowserStackWorkerState>

export interface BrowserStackWorkerDeps {
    /**
     * The BrowserStack REST API.
     */
    readonly client: BrowserStackAutomateClient
}

export interface BrowserStackWorkerOptions {
    /**
     * The number of seconds to wait for data before attempting to retry the test.
     * Default: 45
     */
    readonly captureTimeout?: number

    /**
     * The number of retries to start the session before giving up.
     * Default: 2
     */
    readonly retries?: number

    /**
     * The number of seconds between session update requests.
     * Default: 5
     */
    readonly pollInterval?: number

    /**
     * The directory to emit console logs.
     * Set to null to disable console logging.
     * Default: ./bStackLogs
     */
    readonly logsDir?: string | null

    /**
     * If provided, adds the given query parameters to the launched URL.
     */
    readonly queryParams?: Record<string, string> | null
}

export class BrowserStackWorker {
    /**
     * Set to observe state updates.
     */
    public onUpdate: () => void = () => {}

    private readonly _state: BrowserStackWorkerState
    private tasks = new TaskQueue()
    private pollIntervalId: Timeout | null = null
    private captureTimeoutId: Timeout | null = null
    private options: Required<BrowserStackWorkerOptions>

    /**
     * The worker url with an appended reportApi query param.
     */
    private readonly url: string

    constructor(
        private readonly deps: BrowserStackWorkerDeps,
        workerOptions: WorkerOptions,
        options?: BrowserStackWorkerOptions
    ) {
        this.tasks.onError = (error) => this.setError(error)
        this.options = {
            retries: 2,
            captureTimeout: 45,
            pollInterval: 5,
            logsDir: './bStackLogs',
            queryParams: null,
            ...options,
        }
        this._state = {
            localId: crypto.randomUUID(),
            workerOptions: workerOptions,
            error: null,
            session: null,
            started: false,
            active: false,
            workerId: null,
            sessionId: null,
            totalSpecs: null,
            totalCompleted: 0,
            attemptsRemaining: this.options.retries,
        }
        // Add the reportApi query param:
        const finalUrl = new URL(workerOptions.url)
        finalUrl.searchParams.set('reportApi', `/report/${this._state.localId}`)
        // Add the provided query params from options.
        if (options?.queryParams) {
            for (const [name, value] of Object.entries(options.queryParams)) {
                finalUrl.searchParams.set(name, value)
            }
        }

        this.url = finalUrl.toString()

        if (this.options.logsDir)
            fs.mkdirSync(this.options.logsDir, { recursive: true })
    }

    /**
     * Returns true if this worker is completed. This will be true if either in an error state or the session status
     * indicates completion
     */
    get completed(): boolean {
        const state = this._state
        const status = state.session?.status
        return (
            state.error != null ||
            (state.started &&
                status != null &&
                ['timeout', 'passed', 'failed'].includes(status))
        )
    }

    /**
     * Returns this worker's state.
     */
    get state(): ReadonlyBrowserStackWorkerState {
        return this._state
    }

    get name(): string | undefined {
        return this._state.workerOptions.name
    }

    get passed(): boolean {
        return this._state.session?.status === 'passed'
    }

    set totalCompleted(value: number) {
        this._state.totalCompleted = value
    }

    set totalSpecs(value: number) {
        this._state.totalSpecs = value
    }

    done(passed: boolean, reason: string): Promise<void> {
        const name = this.name
        if (passed) logger.info(`✅ ${name} passed`)
        else logger.info(`❌ ${name} failed\n${reason}\n`)

        const client = this.deps.client
        return this.tasks
            .enqueue(async () => {
                const state = this._state
                const { sessionId, workerId } = state
                if (!sessionId || !workerId) {
                    logger.debug(
                        'done aborting - sessionId or workerId is missing'
                    )
                    return
                }
                logger.debug('done, passed:', passed)
                state.session = await client.updateSession(sessionId, {
                    status: passed ? 'passed' : 'failed',
                    reason: reason,
                })
                this.onUpdate()
            })
            .finally(() => {
                this.terminate().catch(() => {})
            })
    }

    private async refreshSession() {
        const state = this._state
        if (state.sessionId) {
            state.session = await this.deps.client.getSession(state.sessionId)
            this.onUpdate()
        }
    }

    appendLogs(logs: readonly LogEntry[]) {
        if (this.options.logsDir == null || logs.length === 0) return
        const logFilePath = path.join(
            this.options.logsDir,
            `${this._state.sessionId}.log`
        )
        // Append logs to a file.
        fs.appendFile(
            logFilePath,
            logs.map((entry) => entry.join(' ')).join('\n') + '\n',
            (error) => {
                if (error)
                    logger.error('Could not write to console log file:', error)
            }
        )
    }

    /**
     * Creates the worker/session.
     */
    async start(): Promise<void> {
        logger.debug(`Starting session '${this.name}'...`)
        const state = this._state
        state.started = true
        await this.tasks
            .enqueue(async () => {
                if (state.active) return
                state.active = true
                this.onUpdate()

                this.pollIntervalId = setInterval(() => {
                    void this.refreshSession()
                }, this.options.pollInterval * 1000)
                this.captureTimeoutId = setTimeout(
                    this.captureTimeoutHandler,
                    this.options.captureTimeout * 1000
                )

                const client = this.deps.client
                const newWorker = await client.createWorker({
                    ...state.workerOptions,
                    url: this.url,
                })
                state.workerId = newWorker.id
                const workerDetails = await client.getWorker(newWorker.id)
                logger.info(
                    `Session created for '${this.name}': ${workerDetails.browser_url}`
                )
                state.sessionId = workerDetails.sessionId
                await this.refreshSession()
                this.onUpdate()
            })
            .catch((error) => {
                logger.error(`Session start failed '${this.name}'`, error)
                state.started = false
                this.clearTimers()
                this.onUpdate()
            })
    }

    /**
     * Deletes the worker.
     * The worker may be created again.
     */
    terminate(): Promise<void> {
        logger.debug(`Terminate session '${this.name}'`)
        return this.tasks.enqueue(async () => {
            const state = this._state
            if (!state.active) return
            state.active = false
            this.clearTimers()
            const workerId = state.workerId
            if (workerId) {
                state.workerId = null
                try {
                    await this.deps.client.deleteWorker(workerId)
                    logger.debug(`Terminated worker: ${workerId}`)
                } catch (error) {
                    logger.warn('Could not terminate worker:', error)
                }
            }
            logger.debug(`Terminated session '${this.name}'...`)
            this.onUpdate()
        })
    }

    private clearTimers(): void {
        if (this.pollIntervalId) {
            clearInterval(this.pollIntervalId)
            this.pollIntervalId = null
        }
        if (this.captureTimeoutId) {
            clearTimeout(this.captureTimeoutId)
            this.captureTimeoutId = null
        }
    }

    /**
     * Deletes the session if it exists.
     */
    private deleteSession(): Promise<void> {
        const state = this._state
        logger.debug(`Delete session '${this.name}'`)
        return this.tasks.enqueue(async () => {
            const sessionId = state.sessionId
            if (sessionId) {
                state.sessionId = null
                state.session = null
                try {
                    await this.deps.client.deleteSession(sessionId)
                    logger.debug(`Deleted session '${this.name}'`)
                } catch (_) {
                    logger.warn(`Could not delete session '${this.name}'`)
                }
                this.onUpdate()
            }
        })
    }

    /**
     * Terminates the worker, deletes the session, starts a new worker.
     */
    async restart(): Promise<void> {
        await this.terminate().catch(() => {})
        await this.deleteSession().catch(() => {})
        await this.start()
    }

    /**
     * Invoked when the capture timeout has been reached. Checks if data has been received from the REST api.
     */
    private captureTimeoutHandler = () => {
        const state = this._state
        if (state.totalSpecs == null) {
            if (state.attemptsRemaining > 0) {
                state.attemptsRemaining--
                logger.warn(
                    `No test results received for ${this.name}, retrying. Attempts remaining: ${state.attemptsRemaining}`
                )
                this.restart().catch((error) => {
                    this.setError(error)
                })
            } else {
                this.setError(
                    new Error(
                        `Did not capture test progress after ${
                            this.options.retries + 1
                        } attempts for '${this.name}'.`
                    )
                )
            }
        }
    }

    /**
     * Sets the worker to a failed state and terminates.
     */
    private setError(error: any) {
        const state = this._state
        if (state.error) return // Already in an erred state.
        state.error = error
        logger.error(
            error == null
                ? 'An internal error has occurred.'
                : (error.message ?? String(error))
        )
        this.tasks
            .enqueue(async () => {
                if (state.sessionId) {
                    state.session = await this.deps.client.updateSession(
                        state.sessionId,
                        {
                            status: 'failed',
                            reason: error?.message ?? 'Internal error',
                        }
                    )
                    this.onUpdate()
                }
            })
            .catch(() => {})
        this.terminate().catch(() => {})
    }
}
