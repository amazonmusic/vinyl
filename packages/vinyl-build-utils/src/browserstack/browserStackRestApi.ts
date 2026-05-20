/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A partial, typed implementation of the BrowserStack Automate REST API.
 * https://www.browserstack.com/docs/automate/api-reference/selenium/introduction
 * https://www.browserstack.com/docs/automate/capabilities#reference-main-section
 * @module
 */

import { sleep } from '../util/sleep'
import { logger } from '../util/Logger'

/**
 * Browserstack Automate credentials.
 */
export interface BrowserStackCredentials {
    readonly username: string
    readonly key: string
}

export interface BrowserDetails {
    /**
     * Specifies the Browser in the combination.
     */
    readonly browser?: string

    /**
     * Specifies the version of the browser in the combination.
     */
    readonly browser_version?: string

    /**
     * Specifies the OS in the combination.
     */
    readonly os: string

    /**
     * Specifies the version of the OS in the combination.
     */
    readonly os_version: string

    /**
     * Specifies the device name (in case of mobile device), null otherwise.
     */
    readonly device?: string | null
}

/**
 * Worker configuration. Valid browsers and devices can be obtained using the SDK config
 * generator at:
 * {@link https://www.browserstack.com/docs/automate/selenium/sdk-config-generator}
 */
export interface WorkerOptions extends BrowserDetails {
    /**
     * Set the resolution of VM before the beginning of your test. Available for Desktop only.
     * Default is 1024x768.
     */
    readonly resolution?: string

    /**
     * Provide a name to the session/worker.
     * Accepted characters are A-Z, a-z, 0-9, ., :, -, [], /, @, &, ', _.
     */
    readonly name?: string

    /**
     * Time in seconds before the worker is terminated.
     * Defaults to 300 seconds.
     * Irrespective of this value, a browser worker is alive for a maximum time of 1800 seconds.
     */
    readonly timeout?: number

    /**
     * A valid url to navigate the browser to.
     */
    readonly url: string

    /**
     * Optional name of the build the session is running under.
     */
    readonly build?: string

    /**
     * Optional name of the project the build is under.
     */
    readonly project?: string

    /**
     * Optional flag to enable video recording in your test.
     * Default: true
     */
    readonly video?: boolean

    /**
     * Required if you want to capture network logs for your test. Network Logs are supported
     * for all desktop browsers, Android and iOS devices with a few exceptions - IE 10 on any
     * OS; IE 11 on Windows 7 / 8.1 and any browser on MacOS High Sierra and Mojave.
     */
    readonly networkLogs?: boolean
}

export interface NewWorker {
    /**
     * The identifier of the new Worker. Can be used to get worker details which includes the session id.
     */
    readonly id: number

    /**
     * The url of the worker.
     */
    readonly url: string
}

/**
 * https://www.browserstack.com/docs/automate/api-reference/selenium/session#set-test-status
 */
export type SessionUpdateStatus = 'passed' | 'failed'

export interface UpdateSessionOptions {
    /**
     * Set session status to either passed or failed.
     */
    readonly status?: SessionUpdateStatus

    /**
     * Name of your session.
     */
    readonly name?: string

    /**
     * Reason for session failure.
     */
    readonly reason?: string
}

export interface GetSessionsOptions {
    /**
     * Specify the number of results to be displayed. The default value is 10, and the maximum value is 100.
     */
    readonly limit?: number

    /**
     * Retrieve builds from a specific point using the offset parameter.
     */
    readonly offset?: number

    /**
     * Filters the returned sessions to this status.
     */
    readonly status?: ExecutionStatus
}

/**
 * https://www.browserstack.com/docs/automate/api-reference/selenium/build#update-build-details
 */
export interface UpdateBuildOptions {
    /**
     * The new name of the build.
     */
    readonly name?: string
}

export type BuildStatus = 'running' | 'done' | 'timeout' | 'failed'

/**
 * An empty record.
 */
export type AnyRecord = Record<never, any>

export interface PlanDetails {
    /**
     * Specifies your Automate plan name.
     */
    readonly automate_plan: string

    /**
     * Number of parallel sessions currently running.
     */
    readonly parallel_sessions_running: number

    /**
     * Maximum number of parallel sessions allowed in a team.
     */
    readonly team_parallel_sessions_max_allowed: number

    /**
     * Maximum number of parallel sessions you can run.
     */
    readonly parallel_sessions_max_allowed: number

    /**
     * Number of sessions currently queued.
     */
    readonly queued_sessions: number

    /**
     * Maximum number of sessions that can be queued.
     */
    readonly queued_sessions_max_allowed: number
}

/**
 * Information about the worker.
 */
export interface WorkerDetails extends BrowserDetails {
    readonly id: number
    readonly status: SessionStatus
    readonly real_mobile: null | boolean
    readonly browser_url: string
    readonly sessionId: string
}

export interface DeleteWorkerResponse {
    readonly time: number
}

export type SessionStatus =
    | 'passed'
    | 'failed'
    | 'timeout'
    | 'running'
    | 'queued'

export type ExecutionStatus = 'running' | 'done' | 'timeout' | 'queued'

export interface SessionDetails extends BrowserDetails {
    readonly status: SessionStatus

    /**
     * Name of your session.
     */
    readonly name: null | string

    /**
     * Time taken to run the session.
     */
    readonly duration: null | number

    /**
     * ID of the session.
     */
    readonly hashed_id: string

    /**
     * Reason for test status.
     */
    readonly reason: string | null

    /**
     * Name of the build.
     */
    readonly build_name: string

    /**
     * Name of the project.
     */
    readonly project_name: string | null

    /**
     * The build id.
     */
    readonly build_hashed_id: string
}

export interface FullSessionDetails extends SessionDetails {
    /**
     * URL to view the session logs.
     */
    readonly logs: string

    /**
     * Execution status of the session.
     */
    readonly browserstack_status: ExecutionStatus

    /**
     * URL to view the session on Automate dashboard.
     */
    readonly browser_url: string

    /**
     * URL to view the session publicly.
     */
    readonly public_url: string

    /**
     * URL to view appium logs.
     */
    readonly appium_logs_url: string

    /**
     * URL to view session video.
     */
    readonly video_url: string

    /**
     * URL to view browser’s console logs.
     */
    readonly browser_console_logs_url: string

    /**
     * URL to view browser logs.
     */
    readonly har_logs_url: string

    /**
     * URL to view selenium logs.
     */
    readonly selenium_logs_url: string

    /**
     * URL to view telemetry logs if it is enabled in your Selenium 4 session.
     */
    readonly selenium_telemetry_logs_url: string
}

export interface DeleteResponse {
    readonly status: 'ok' | string
    readonly message: string
}

export interface GetBuildsOptions {
    /**
     * Specify the number of results to be displayed. The default value is 10, and the maximum value is 100.
     */
    readonly limit?: number

    /**
     * Retrieve builds from a specific point using the offset parameter.
     */
    readonly offset?: number

    /**
     * The status parameter filters your results by the status of the build.
     * The values accepted by this parameter are running, done, timeout, and failed.
     */
    readonly status?: BuildStatus

    /**
     * Retrieve all builds related to the specified project ID.
     */
    readonly projectId?: number
}

const API = 'https://api.browserstack.com/5'

const retryableStatuses = new Set([
    400, // Bad request
    429, // Too many requests
    502, // Bad gateway
    503, // Service unavailable
    504, // Gateway timeout
])

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

class BrowserStackClient {
    constructor(readonly credentials: BrowserStackCredentials) {}

    async createWorker(options: WorkerOptions): Promise<NewWorker> {
        return this.doRequest(`${API}/worker`, 'POST', options)
    }

    async deleteWorker(workerId: number): Promise<DeleteWorkerResponse> {
        return this.doRequest(`${API}/worker/${workerId}`, 'DELETE')
    }

    async getWorker(workerId: number): Promise<WorkerDetails> {
        const workerDetails = await this.doRequest(
            `${API}/worker/${workerId}`,
            'GET'
        )
        if (!('sessionId' in workerDetails)) {
            throw new Error(`worker ${workerId} not found`)
        }
        return workerDetails
    }

    /**
     * Deletes a build and all sessions contained within it. Builds once deleted cannot be recovered.
     * @param buildId
     */
    async deleteBuild(buildId: number): Promise<DeleteWorkerResponse> {
        return this.doRequest(`${API}/builds/${buildId}`, 'DELETE')
    }

    protected async doRequest(
        url: string,
        method: RequestMethod,
        body?: any,
        type: 'json' | 'text' = 'json',
        retries = 3
    ): Promise<any> {
        let response: Response | null = null
        let error: Error | null = null
        let retryable = retries > 0
        try {
            response = await fetch(url, {
                method,
                headers: {
                    Authorization: `Basic ${Buffer.from(
                        `${this.credentials.username}:${this.credentials.key}`
                    ).toString('base64')}`,
                    'Content-Type':
                        type === 'json' ? 'application/json' : 'text/plain',
                },
                body: body ? JSON.stringify(body) : null,
            })
            if (!response.ok) {
                error = new ServiceResponseError(url, method, response)
                retryable &&= retryableStatuses.has(response.status)
            }
        } catch (e: any) {
            error = e
        }
        if (error) {
            if (retryable) {
                logger.warn(`${error.message}, retrying in 5s`)
                await sleep(5)
                return this.doRequest(url, method, body, type, retries - 1)
            } else {
                throw error
            }
        }
        return type === 'json' ? await response!.json() : await response!.text()
    }
}

export class ServiceResponseError extends Error {
    constructor(
        readonly url: string,
        readonly method: RequestMethod,
        readonly response: Response
    ) {
        super(
            `BrowserStack API error: ${url} ${method} ${response.status} ${response.statusText}`
        )
    }
}

const AUTOMATE_API = 'https://api.browserstack.com/automate'

export class BrowserStackAutomateClient extends BrowserStackClient {
    async getPlan(): Promise<PlanDetails> {
        return await this.doRequest(`${AUTOMATE_API}/plan.json`, 'GET')
    }

    async getSessions(
        buildId: string,
        options: GetSessionsOptions
    ): Promise<readonly FullSessionDetails[]> {
        return (
            await this.doRequest(
                `${AUTOMATE_API}/builds/${buildId}/sessions.json`,
                'GET',
                options
            )
        ).map((element: any) => {
            return element['automation_session']
        })
    }

    async getSession(sessionId: string): Promise<FullSessionDetails> {
        return (
            await this.doRequest(
                `${AUTOMATE_API}/sessions/${sessionId}.json`,
                'GET'
            )
        )['automation_session']
    }

    async updateSession(
        sessionId: string,
        options: UpdateSessionOptions
    ): Promise<SessionDetails> {
        return (
            await this.doRequest(
                `${AUTOMATE_API}/sessions/${sessionId}.json`,
                'PUT',
                options
            )
        )['automation_session']
    }

    /**
     * Deletes a session.
     * Sessions once deleted cannot be recovered.
     * @param sessionId
     */
    async deleteSession(sessionId: string): Promise<DeleteResponse> {
        return this.doRequest(
            `${AUTOMATE_API}/sessions/${sessionId}.json`,
            'DELETE'
        )
    }

    async getBuilds(
        options: GetBuildsOptions
    ): Promise<WorkerDetails | AnyRecord> {
        return this.doRequest(`${AUTOMATE_API}/builds.json`, 'GET', options)
    }

    async updateBuild(
        buildId: string,
        buildOptions: UpdateBuildOptions
    ): Promise<WorkerDetails | AnyRecord> {
        return this.doRequest(
            `${AUTOMATE_API}/builds/${buildId}.json`,
            'PUT',
            buildOptions
        )
    }
}
