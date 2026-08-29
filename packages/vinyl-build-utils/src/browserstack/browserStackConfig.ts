/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Framework-agnostic BrowserStack run/worker configuration, shared by runners
 * (e.g. `@amazon/vinyl-browserstack`) regardless of the session transport.
 * @module
 */

import { config as dotEnvConfig } from 'dotenv'
import path from 'node:path'
import process from 'node:process'
import type { Options as BsLocalOptions } from 'browserstack-local'
import type { ServerOptions } from '../express/serve'
import type { LogLevel } from '../util/Logger'
import { getRootProjectDir } from '../util/getRootProjectDir'
import type {
    BrowserDetails,
    BrowserStackCredentials,
    WorkerOptions,
} from './browserStackRestApi'

/**
 * Per-worker (per-session) runtime configuration.
 */
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

/**
 * Configuration for a controller that schedules many workers.
 */
export interface BrowserStackWorkerControllerOptions {
    /**
     * Configuration to provide to each worker.
     */
    readonly worker?: BrowserStackWorkerOptions

    /**
     * The maximum number of sessions to run in parallel.
     * If not set, the maximum number of sessions according to the automate plan
     * will be used.
     */
    readonly maxSessions?: number
}

export interface BrowserStackOptions extends BrowserStackWorkerControllerOptions {
    /**
     * BrowserStack local connection options.
     */
    readonly local?: Partial<BsLocalOptions>

    /**
     * Local server configuration.
     */
    readonly server: ServerOptions

    /**
     * The BrowserStack credentials. If undefined, taken from the environment
     * variables BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY (a `.env` file
     * is honored).
     */
    readonly credentials?:
        | BrowserStackCredentials
        | Promise<BrowserStackCredentials>

    /**
     * The list of browsers to test against.
     * `name`, if not provided, is generated from '<device> <os> <browser> <browser_version>'.
     */
    readonly browsers: readonly WorkerInitOptions[]

    /**
     * Options common to all workers. `build` defaults to a unique identifier.
     */
    readonly workerCommon?: CommonWorkerInitOptions

    /**
     * If true, shows continuous progress in the console. If false, progress is
     * logged in at most 10% increments (recommended for CI). Default: true when
     * process.stdout is a terminal.
     */
    readonly stickyProgress?: boolean

    /**
     * If true, terminates all workers on the first failure. Default: false
     */
    readonly stopOnFirstFailure?: boolean

    /**
     * Sets the log verbosity. Default: LogLevel.INFO
     */
    readonly logLevel?: LogLevel
}

/**
 * Options used as defaults for all workers. Values set on the worker take
 * priority.
 */
export type CommonWorkerInitOptions = Omit<
    WorkerInitOptions,
    keyof BrowserDetails
>

export interface WorkerInitOptions extends Omit<WorkerOptions, 'url'> {
    /**
     * A valid url to navigate the browser to. If not set, the local server URL
     * is used.
     */
    readonly url?: string
}

/**
 * When the BrowserStack run has completed, provides the final results.
 */
export interface BrowserStackResults {
    readonly passed: boolean
}

/**
 * Attempts to get the BrowserStackCredentials from the environment.
 */
export function getEnvBrowserStackCredentials(): BrowserStackCredentials {
    const rootDir = getRootProjectDir()
    if (!rootDir)
        throw new Error(
            'Could not find root project dir from current working directory.'
        )
    dotEnvConfig({ path: path.resolve(rootDir, '.env') })
    return {
        username: process.env.BROWSERSTACK_USERNAME!,
        key: process.env.BROWSERSTACK_ACCESS_KEY!,
    }
}
