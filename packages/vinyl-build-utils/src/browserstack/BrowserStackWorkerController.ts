/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    BrowserStackWorkerOptions,
    ReadonlyBrowserStackWorkerState,
} from './BrowserStackWorker'
import { BrowserStackWorker } from './BrowserStackWorker'
import type {
    BrowserStackAutomateClient,
    WorkerOptions,
} from './browserStackRestApi'
import type {
    DoneRequest,
    ProgressRequest,
    ReportingListener,
    StartedRequest,
} from './configureReporterApi'
import { logger } from '../util/Logger'

export interface BrowserStackWorkerControllerDeps {
    /**
     * The BrowserStack REST API client.
     */
    readonly client: BrowserStackAutomateClient
}

export interface BrowserStackWorkerControllerOptions {
    /**
     * Configuration to provide to each Worker.
     */
    readonly worker?: BrowserStackWorkerOptions

    /**
     * The maximum number of sessions to run in parallel.
     * If not set, the maximum number of sessions according to the automate plan will be used.
     */
    readonly maxSessions?: number
}

export interface BrowserStackWorkerControllerState {
    readonly workers: readonly ReadonlyBrowserStackWorkerState[]

    /**
     * The number of workers not yet started.
     */
    pending: number

    /**
     * The number of workers currently active.
     */
    running: number

    /**
     * The number of workers completed and passed.
     */
    passed: number

    /**
     * The number of workers completed and failed.
     */
    failed: number

    /**
     * The estimated percentage complete, a number from 0-1.
     */
    percentComplete: number

    /**
     * The total number of workers not yet completed.
     */
    remaining: number

    /**
     * The total number of workers.
     */
    readonly total: number
}

export type ReadonlyBrowserStackWorkerControllerState =
    Readonly<BrowserStackWorkerControllerState>

type Timeout = ReturnType<typeof setTimeout>

export class BrowserStackWorkerController implements ReportingListener {
    /**
     * Set to observe state updates.
     */
    public onUpdate: () => void = () => {}

    private readonly _state: BrowserStackWorkerControllerState
    private readonly workers: BrowserStackWorker[]

    /**
     * Maps the worker's local id to the worker.
     */
    private readonly localIdToWorkerMap: Map<string, BrowserStackWorker>

    private sessionPollIntervalId: Timeout | null = null

    /**
     * Tracks an in-flight startSessions invocation. While set, additional calls
     * are deferred until the current one settles to avoid redundant API calls
     * and racing state updates.
     */
    private startSessionsInFlight: Promise<void> | null = null

    /**
     * If set during an in-flight startSessions, indicates another invocation
     * was requested and should run after the current one settles.
     */
    private startSessionsRequested = false

    constructor(
        private readonly deps: BrowserStackWorkerControllerDeps,
        browsers: readonly WorkerOptions[],
        private readonly options?: BrowserStackWorkerControllerOptions
    ) {
        this.workers = browsers.map(
            (browser) => new BrowserStackWorker(deps, browser, options?.worker)
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
            this.workers.map((worker) => {
                return [worker.state.localId, worker]
            })
        )

        // Observe state on all workers
        for (const worker of this.workers) {
            worker.onUpdate = this.updateHandler
        }
    }

    get state(): ReadonlyBrowserStackWorkerControllerState {
        return this._state
    }

    shouldHandleRequest(id: string): boolean {
        return this.localIdToWorkerMap.has(id)
    }

    onStarted(request: StartedRequest): void {
        const worker = this.localIdToWorkerMap.get(request.id)!
        worker.totalSpecs = request.totalSpecs
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
            const completed = worker.completed
            if (completed) {
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

    /**
     * Refreshes the current state and invokes the onUpdate callback.
     */
    private updateHandler = () => {
        const state = this._state
        const previousRunning = state.running
        this.refreshState()
        if (previousRunning !== state.running) this.startSessions()
        this.onUpdate()
    }

    /**
     * Begins new workers until the maximum parallel sessions is reached.
     * Reentrancy-safe: if invoked while a previous invocation is still
     * running, schedules a single follow-up to run after it settles.
     */
    private startSessions(): void {
        if (this.startSessionsInFlight) {
            this.startSessionsRequested = true
            return
        }
        const run = (async () => {
            const state = this._state
            if (state.pending === 0) return
            const client = this.deps.client
            const planDetails = await client.getPlan()
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
            // Takes up to [remainingOpenSessions] pending workers, starts them in parallel, and awaits their startup.
            const workersToStart = this.workers
                .filter((worker) => !worker.state.started)
                .slice(0, remainingOpenSessions)
            if (workersToStart.length) {
                logger.debug(`Starting ${workersToStart.length} sessions...`)
                // Start all workers in parallel
                await Promise.all(
                    workersToStart.map((worker) =>
                        worker.start().catch(() => {})
                    )
                )
            }

            this.refreshState()

            if (this._state.pending > 0) {
                // There are pending sessions that were not started, either due
                // no open sessions or a worker start failure.
                // Check if a session opens up after a timeout.
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
                // Schedule a retry rather than abandoning all pending workers;
                // a transient API failure should not permanently strand them.
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
                    // A coalesced request supersedes any retry scheduled by
                    // .catch(); otherwise both the immediate run here and the
                    // delayed timeout below would fire startSessions().
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
        logger.debug(`BrowserStackWorkerController start`)
        this.startSessions()
    }

    /**
     * Terminates all running workers.
     */
    async terminate(): Promise<void> {
        logger.debug(`Terminating workers`)
        this.clearOpenSessionPollTimeout()
        await Promise.all(
            this.workers.map((worker) =>
                worker.terminate().catch(() => {
                    logger.warn(
                        `Could not terminate worker: '${worker.state.workerOptions.name}'`
                    )
                })
            )
        ).finally(() => {
            logger.debug('terminate done')
        })
    }
}
