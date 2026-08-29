/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type BrowserStackAutomateClient,
    type BrowserStackCredentials,
    type BrowserStackWorkerOptions,
    type LogEntry,
    logger,
    type SessionDetails,
    TaskQueue,
    type WorkerOptions,
} from '@amazon/vinyl-build-utils'
import { Builder, type WebDriver } from 'selenium-webdriver'
import { buildCapabilities } from './capabilities'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import Timeout = NodeJS.Timeout

/**
 * The default BrowserStack WebDriver hub.
 */
export const DEFAULT_HUB_URL = 'https://hub-cloud.browserstack.com/wd/hub'

/**
 * Local state for a single WebDriver session.
 */
export interface WebDriverWorkerState {
    /**
     * A local identifier, used to map reporter API calls back to this session.
     */
    readonly localId: string

    /**
     * The browser configuration provided during construction. Replaced with the
     * fallback browser combination if the worker exhausts its capture retries
     * without reporting any progress (see {@link WorkerOptions.fallbackBrowser}).
     */
    workerOptions: WorkerOptions

    /**
     * If non-null, indicates a fatal error.
     */
    error: Error | null

    /**
     * The session details, as retrieved from the BrowserStack Automate API.
     */
    session: SessionDetails | null

    /**
     * True once {@link WebDriverWorker.start} has been called. Does not become
     * false after termination.
     */
    started: boolean

    /**
     * True while the WebDriver session is active.
     */
    active: boolean

    /**
     * The BrowserStack session hash (the WebDriver session id). Set once the
     * session is established. There is no separate numeric worker id in the
     * WebDriver transport.
     */
    sessionId: string | null

    /**
     * The total number of specs, as reported by the in-browser reporter.
     * Null until received.
     */
    totalSpecs: number | null

    /**
     * The number of specs completed, as reported by the in-browser reporter.
     */
    totalCompleted: number

    /**
     * The number of capture retry attempts remaining. A retry happens on a
     * capture timeout (no progress), not on a test failure.
     */
    attemptsRemaining: number
}

export type ReadonlyWebDriverWorkerState = Readonly<WebDriverWorkerState>

export interface WebDriverWorkerDeps {
    /**
     * The BrowserStack Automate REST client, used for session status polling
     * and pass/fail stamping (endpoints that apply to WebDriver sessions).
     */
    readonly client: BrowserStackAutomateClient

    /**
     * Credentials, placed in the session capabilities.
     */
    readonly credentials: BrowserStackCredentials

    /**
     * The WebDriver hub URL. Defaults to {@link DEFAULT_HUB_URL}.
     */
    readonly hubUrl?: string
}

/**
 * Drives a single BrowserStack session over Selenium/WebDriver: it builds a
 * real session, navigates it to the in-browser test URL, keeps it alive while
 * the specs run, and quits it when done. The in-browser Jasmine suite reports
 * progress/pass-fail out of band via the reporter REST API, exactly as with the
 * legacy worker transport.
 */
export class WebDriverWorker {
    /**
     * Set to observe state updates.
     */
    public onUpdate: () => void = () => {}

    private readonly _state: WebDriverWorkerState
    private tasks = new TaskQueue()
    private driver: WebDriver | null = null
    private pollIntervalId: Timeout | null = null
    private captureTimeoutId: Timeout | null = null
    private maxDurationTimeoutId: Timeout | null = null
    private options: Required<BrowserStackWorkerOptions>

    /**
     * The worker url with an appended reportApi query param.
     */
    private readonly url: string

    constructor(
        private readonly deps: WebDriverWorkerDeps,
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
            workerOptions,
            error: null,
            session: null,
            started: false,
            active: false,
            sessionId: null,
            totalSpecs: null,
            totalCompleted: 0,
            attemptsRemaining: this.options.retries,
        }
        const finalUrl = new URL(workerOptions.url)
        finalUrl.searchParams.set('reportApi', `/report/${this._state.localId}`)
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
     * True once the session status indicates completion or an error occurred.
     * The reporter's `done` stamps the passed/failed status via the Automate API.
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

    get state(): ReadonlyWebDriverWorkerState {
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
                const { sessionId } = this._state
                if (!sessionId) {
                    logger.debug('done aborting - sessionId is missing')
                    return
                }
                logger.debug('done, passed:', passed)
                this._state.session = await client.updateSession(sessionId, {
                    status: passed ? 'passed' : 'failed',
                    reason,
                })
                this.onUpdate()
            })
            .finally(() => {
                this.terminate().catch(() => {})
            })
    }

    private async refreshSession() {
        const state = this._state
        if (!state.sessionId) return
        const previousStatus = state.session?.status
        state.session = await this.deps.client.getSession(state.sessionId)
        if (
            state.session.status === 'timeout' &&
            previousStatus !== 'timeout'
        ) {
            const secs = state.workerOptions.timeout
            logger.error(
                `⏱️ ${this.name} timed out${secs ? ` after ${secs}s` : ''} — ` +
                    `session ended before tests completed; counts as a failure`
            )
        }
        this.onUpdate()
    }

    /**
     * Sends a no-op WebDriver command to reset the session idle timer. A
     * WebDriver session is killed by `idleTimeout` if no commands are sent, but
     * the specs run in-browser with zero driver interaction. REST status polling
     * does NOT reset the idle timer, so this keep-alive is required.
     */
    private async keepAlive() {
        try {
            await this.driver?.getTitle()
        } catch (error) {
            logger.debug(`keep-alive failed for '${this.name}':`, error)
        }
    }

    appendLogs(logs: readonly LogEntry[]) {
        if (this.options.logsDir == null || logs.length === 0) return
        const logFilePath = path.join(
            this.options.logsDir,
            `${this._state.sessionId}.log`
        )
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
     * Builds the WebDriver session and navigates it to the test URL.
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
                    void this.keepAlive()
                    void this.refreshSession()
                }, this.options.pollInterval * 1000)
                this.captureTimeoutId = setTimeout(
                    this.captureTimeoutHandler,
                    this.options.captureTimeout * 1000
                )
                // WebDriver has no server-side total-worker timeout (unlike the
                // legacy /5/worker `timeout`), so enforce it locally as a
                // max-duration safety net for runaway sessions.
                const timeout = state.workerOptions.timeout
                if (timeout) {
                    this.maxDurationTimeoutId = setTimeout(() => {
                        this.setError(
                            new Error(
                                `Session '${this.name}' exceeded max duration of ${timeout}s.`
                            )
                        )
                    }, timeout * 1000)
                }

                // fallbackBrowser is a local concern, not a capability.
                const { fallbackBrowser: _fallbackBrowser, ...workerOptions } =
                    state.workerOptions
                const capabilities = buildCapabilities(
                    { ...workerOptions, url: this.url },
                    this.deps.credentials
                )
                const driver = await new Builder()
                    .usingServer(this.deps.hubUrl ?? DEFAULT_HUB_URL)
                    .withCapabilities(capabilities)
                    .build()
                this.driver = driver
                state.sessionId = (await driver.getSession()).getId()
                logger.info(
                    `Session created for '${this.name}': ${state.sessionId}`
                )
                await driver.get(this.url)
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
     * Quits the WebDriver session. The session may be created again.
     */
    terminate(): Promise<void> {
        logger.debug(`Terminate session '${this.name}'`)
        return this.tasks.enqueue(async () => {
            const state = this._state
            if (!state.active) return
            state.active = false
            this.clearTimers()
            const driver = this.driver
            if (driver) {
                this.driver = null
                try {
                    await driver.quit()
                    logger.debug(`Quit session '${this.name}'`)
                } catch (error) {
                    // The session may already be gone (e.g. BrowserStack ended
                    // it); a failed quit is not fatal.
                    logger.warn('Could not quit WebDriver session:', error)
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
        if (this.maxDurationTimeoutId) {
            clearTimeout(this.maxDurationTimeoutId)
            this.maxDurationTimeoutId = null
        }
    }

    /**
     * Terminates the session, then starts a fresh one.
     */
    async restart(): Promise<void> {
        await this.terminate().catch(() => {})
        this._state.sessionId = null
        this._state.session = null
        await this.start()
    }

    /**
     * Invoked when the capture timeout is reached; retries (or falls back) if no
     * test progress has been received yet.
     */
    private captureTimeoutHandler = () => {
        const state = this._state
        if (state.totalSpecs != null) return
        if (state.attemptsRemaining > 0) {
            state.attemptsRemaining--
            logger.warn(
                `No test results received for ${this.name}, retrying. Attempts remaining: ${state.attemptsRemaining}`
            )
            this.restart().catch((error) => this.setError(error))
        } else if (!this.tryFallbackBrowser()) {
            this.setError(
                new Error(
                    `Did not capture test progress after ${
                        this.options.retries + 1
                    } attempts for '${this.name}'.`
                )
            )
        }
    }

    /**
     * If a fallback browser is configured, swaps to it (keeping the rest of the
     * worker options), resets the retry budget, and restarts. Returns true if a
     * fallback was available.
     */
    private tryFallbackBrowser(): boolean {
        const state = this._state
        const { fallbackBrowser } = state.workerOptions
        if (!fallbackBrowser) return false
        const target = [
            fallbackBrowser.device,
            fallbackBrowser.os,
            fallbackBrowser.os_version,
            fallbackBrowser.browser,
            fallbackBrowser.browser_version,
        ]
            .filter(Boolean)
            .join(' ')
        logger.warn(
            `Did not capture test progress for '${this.name}'; falling back to '${target}'.`
        )
        const {
            fallbackBrowser: _fallbackBrowser,
            browser: _browser,
            browser_version: _browserVersion,
            device: _device,
            ...rest
        } = state.workerOptions
        state.workerOptions = {
            ...rest,
            ...fallbackBrowser,
            name: `${target} [fallback]`,
        }
        state.attemptsRemaining = this.options.retries
        this.restart().catch((error) => this.setError(error))
        return true
    }

    /**
     * Sets the worker to a failed state and terminates.
     */
    private setError(error: any) {
        const state = this._state
        if (state.error) return
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
