/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type BrowserStackAutomateClient,
    type BrowserStackCredentials,
    type BrowserStackWorkerControllerOptions,
    type DoneRequest,
    logger,
    type ProgressRequest,
    type ReportingListener,
    type StartedRequest,
    type WorkerOptions,
} from '@amazon/vinyl-build-utils'
import {
    type ReadonlyWebDriverWorkerState,
    WebDriverWorker,
} from './WebDriverWorker'

export interface WebDriverWorkerControllerDeps {
    /**
     * The BrowserStack Automate REST client.
     */
    readonly client: BrowserStackAutomateClient

    /**
     * Credentials, forwarded to each worker's session capabilities.
     */
    readonly credentials: BrowserStackCredentials

    /**
     * The WebDriver hub URL. Defaults per {@link WebDriverWorker}.
     */
    readonly hubUrl?: string
}

export interface WebDriverWorkerControllerState {
    readonly workers: readonly ReadonlyWebDriverWorkerState[]
    pending: number
    running: number
    passed: number
    failed: number
    percentComplete: number
    remaining: number
    readonly total: number
}

export type ReadonlyWebDriverWorkerControllerState =
    Readonly<WebDriverWorkerControllerState>

type Timeout = ReturnType<typeof setTimeout>

/**
 * Schedules and parallelizes {@link WebDriverWorker}s up to the account's
 * available parallel-session budget, and fans the reporter REST callbacks out
 * to the matching worker. Transport-agnostic scheduling logic mirrors the
 * legacy controller; only the worker type differs.
 */
export class WebDriverWorkerController implements ReportingListener {
    public onUpdate: () => void = () => {}

    private readonly _state: WebDriverWorkerControllerState
    private readonly workers: WebDriverWorker[]
    private readonly localIdToWorkerMap: Map<string, WebDriverWorker>
    private sessionPollIntervalId: Timeout | null = null
    private startSessionsInFlight: Promise<void> | null = null
    private startSessionsRequested = false

    constructor(
        private readonly deps: WebDriverWorkerControllerDeps,
        browsers: readonly WorkerOptions[],
        private readonly options?: BrowserStackWorkerControllerOptions
    ) {
        this.workers = browsers.map(
            (browser) => new WebDriverWorker(deps, browser, options?.worker)
        )
        this._state = {
            workers: this.workers.map((worker) => worker.state),
            pending: this.workers.length,
            remaining: this.workers.length,
            running: 0,
            failed: 0,
            passed: 0,
            percentComplete: 0,
            total: this.workers.length,
        }
        this.localIdToWorkerMap = new Map(
            this.workers.map((worker) => [worker.state.localId, worker])
        )
        for (const worker of this.workers) {
            worker.onUpdate = this.updateHandler
        }
    }

    get state(): ReadonlyWebDriverWorkerControllerState {
        return this._state
    }

    shouldHandleRequest(id: string): boolean {
        return this.localIdToWorkerMap.has(id)
    }

    onStarted(request: StartedRequest): void {
        this.localIdToWorkerMap.get(request.id)!.totalSpecs = request.totalSpecs
    }

    onProgress(request: ProgressRequest): void {
        const worker = this.localIdToWorkerMap.get(request.id)!
        worker.totalCompleted = request.totalCompleted
        worker.appendLogs(request.logs)
    }

    onDone(request: DoneRequest): void {
        const worker = this.localIdToWorkerMap.get(request.id)!
        void worker.done(
            request.overallStatus === 'passed',
            request.reason ?? ''
        )
    }

    private refreshState() {
        const state = this._state
        let running = 0
        let pending = 0
        let failed = 0
        let passed = 0
        let percentSum = 0
        for (const worker of this.workers) {
            if (worker.completed) {
                if (worker.passed) passed++
                else failed++
                percentSum++
            } else {
                if (worker.state.started) running++
                else pending++
                percentSum +=
                    worker.state.totalCompleted / (worker.state.totalSpecs || 1)
            }
        }
        state.running = running
        state.pending = pending
        state.failed = failed
        state.passed = passed
        state.remaining = running + pending
        state.percentComplete = percentSum / (state.total || 1)
    }

    private updateHandler = () => {
        const state = this._state
        const previousRunning = state.running
        this.refreshState()
        if (previousRunning !== state.running) this.startSessions()
        this.onUpdate()
    }

    /**
     * Starts pending workers up to the available parallel-session budget.
     * Reentrancy-safe: coalesces overlapping invocations into a single follow-up.
     */
    private startSessions(): void {
        if (this.startSessionsInFlight) {
            this.startSessionsRequested = true
            return
        }
        const run = (async () => {
            const state = this._state
            if (state.pending === 0) return
            const planDetails = await this.deps.client.getPlan()
            const remainingOpenSessions =
                Math.min(
                    this.options?.maxSessions ?? Number.MAX_SAFE_INTEGER,
                    planDetails.parallel_sessions_max_allowed
                ) -
                Math.max(state.running, planDetails.parallel_sessions_running)
            logger.debug(
                'Plan parallel sessions:',
                `${planDetails.parallel_sessions_running} running, ${planDetails.parallel_sessions_max_allowed} allowed`
            )
            const workersToStart = this.workers
                .filter((worker) => !worker.state.started)
                .slice(0, remainingOpenSessions)
            if (workersToStart.length) {
                logger.debug(`Starting ${workersToStart.length} sessions...`)
                await Promise.all(
                    workersToStart.map((worker) =>
                        worker.start().catch(() => {})
                    )
                )
            }
            this.refreshState()
            if (this._state.pending > 0) {
                logger.debug('No open sessions, checking again in 15s.')
                this.clearOpenSessionPollTimeout()
                this.sessionPollIntervalId = setTimeout(
                    () => this.startSessions(),
                    15000
                )
            }
        })()
            .catch((error) => {
                logger.warn('startSessions failed', error)
                this.clearOpenSessionPollTimeout()
                this.sessionPollIntervalId = setTimeout(
                    () => this.startSessions(),
                    15000
                )
            })
            .finally(() => {
                this.startSessionsInFlight = null
                if (this.startSessionsRequested) {
                    this.startSessionsRequested = false
                    this.clearOpenSessionPollTimeout()
                    this.startSessions()
                }
            })
        this.startSessionsInFlight = run
    }

    private clearOpenSessionPollTimeout() {
        if (this.sessionPollIntervalId != null) {
            clearTimeout(this.sessionPollIntervalId)
            this.sessionPollIntervalId = null
        }
    }

    get allPassed(): boolean {
        return this.workers.every((worker) => worker.passed)
    }

    start(): void {
        logger.debug('WebDriverWorkerController start')
        this.startSessions()
    }

    async terminate(): Promise<void> {
        logger.debug('Terminating workers')
        this.clearOpenSessionPollTimeout()
        await Promise.all(
            this.workers.map((worker) =>
                worker.terminate().catch(() => {
                    logger.warn(
                        `Could not terminate worker: '${worker.state.workerOptions.name}'`
                    )
                })
            )
        ).finally(() => logger.debug('terminate done'))
    }
}
