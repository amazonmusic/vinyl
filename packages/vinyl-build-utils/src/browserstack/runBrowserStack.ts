/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { config as dotEnvConfig } from 'dotenv'
import express from 'express'
import { startExpressServer } from '../express/startExpressServer'
import type { ServerOptions } from '../express/serve'
import { configureExpress } from '../express/serve'
import type {
    BrowserDetails,
    BrowserStackCredentials,
    WorkerOptions,
} from './browserStackRestApi'
import { BrowserStackAutomateClient } from './browserStackRestApi'
import { startBrowserStackLocal } from './browserStackLocal'
import type { Options as BsLocalOptions } from 'browserstack-local'
import type { BrowserStackWorkerControllerOptions } from './BrowserStackWorkerController'
import { BrowserStackWorkerController } from './BrowserStackWorkerController'
import { configureReportingApi } from './configureReporterApi'
import process from 'node:process'
import { logger, LogLevel } from '../util/Logger'
import { ansi, progressBar } from '../util/console'
import { getRootProjectDir } from '../util/getRootProjectDir'
import path from 'node:path'
import crypto from 'node:crypto'

export interface BrowserStackOptions
    extends BrowserStackWorkerControllerOptions {
    /**
     * BrowserStack local connection options.
     */
    readonly local?: Partial<BsLocalOptions>

    /**
     * Local server configuration.
     */
    readonly server: ServerOptions

    /**
     * The BrowserStack credentials, if undefined these will be taken from the environment variables
     * BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY.
     * If a `.env` file exists, it will be used to populate environmental variables.
     */
    readonly credentials?:
        | BrowserStackCredentials
        | Promise<BrowserStackCredentials>

    /**
     * The list of browsers to test against.
     * `name` if not provided will be generated using '<device> <os> <browser> <browser_version>'.
     *
     * Valid browsers and devices can be obtained using the SDK config generator at:
     * {@link https://www.browserstack.com/docs/automate/selenium/sdk-config-generator}
     */
    readonly browsers: readonly WorkerInitOptions[]

    /**
     * Options common to all workers.
     *
     * `build` will default to a unique identifier if not provided.
     */
    readonly workerCommon?: CommonWorkerInitOptions

    /**
     * If true, shows continuous progress in the console.
     * If false, progress will be logged in at most 10% increments.
     *
     * Recommended to set to false for CI environments.
     * Default: true when the process.stdout is a terminal.
     */
    readonly stickyProgress?: boolean

    /**
     * If true, terminates all workers on the first failure.
     * Default: false
     */
    readonly stopOnFirstFailure?: boolean

    /**
     * Sets the log verbosity.
     * Default: LogLevel.INFO
     */
    readonly logLevel?: LogLevel
}

/**
 * Options to be used as defaults for all workers.
 * Values set on the worker will take priority.
 */
export type CommonWorkerInitOptions = Omit<
    WorkerInitOptions,
    keyof BrowserDetails
>

export interface WorkerInitOptions extends Omit<WorkerOptions, 'url'> {
    /**
     * A valid url to navigate the browser to.
     * If not set, the local server URL will be used.
     */
    readonly url?: string
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
    dotEnvConfig({
        path: path.resolve(rootDir, '.env'),
    })
    return {
        username: process.env.BROWSERSTACK_USERNAME!,
        key: process.env.BROWSERSTACK_ACCESS_KEY!,
    }
}

/**
 * When the BrowserStack run has completed, provides the final results.
 */
export interface BrowserStackResults {
    readonly passed: boolean
}

/**
 * Runs tests on BrowserStack.
 *
 * This will:
 * - Start a local server including a REST API for serving tests that are expected to report their progress to the
 * service.
 * - Start the BrowserStack local tunnel.
 * - Enqueue workers for each provided browser.
 *
 * @return Returns a Promise with the test results.
 *
 * Example:
 *
 * ```
 * void runBrowserStack({
 *     server: {
 *         port: 9009,
 *         staticDir: './dist/test',
 *     },
 *     browsers: [
 *         {
 *             browser: 'chrome',
 *             browser_version: 'latest',
 *             os: 'OS X',
 *             os_version: 'Monterey',
 *         },
 *         {
 *             browser: 'safari',
 *             browser_version: 'latest',
 *             os: 'OS X',
 *             os_version: 'Monterey',
 *         },
 *     ],
 *     workerCommon: {
 *         project: 'MyProject',
 *     },
 * }).then((result) => {
 *     if (!result.passed) process.exit(1)
 * })
 * ```
 */
export async function runBrowserStack(
    options: BrowserStackOptions
): Promise<BrowserStackResults> {
    // Validate options argument
    if (!options.browsers.length)
        throw new Error('options.browsers is required')

    let done: (results: BrowserStackResults) => void
    const donePromise = new Promise<BrowserStackResults>((r) => (done = r))
    const bsCredentials =
        (await options.credentials) ?? getEnvBrowserStackCredentials()
    if (!bsCredentials.username || !bsCredentials.key)
        throw new Error(
            'Missing BrowserStack credentials. May be provided via options.credentials, or the environmental ' +
                'variables BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY. ' +
                'Environmental variables may be set via a .env file.'
        )

    // Use the explicitly set stickyProgress value, or default to true if the stdout is a terminal.
    const useSticky = options.stickyProgress ?? process.stdout.isTTY
    logger.level = options.logLevel ?? LogLevel.INFO

    const localOptions: Partial<BsLocalOptions> = {
        key: bsCredentials.key,
        logFile: './bStackLogs/local.log',
        ...options.local,
    } as const

    const shutdownLocalTunnel = await startBrowserStackLocal(localOptions)

    const app = express()
    configureExpress(app, options.server)
    const serverHandle = await startExpressServer({ app }, options.server)

    const client = new BrowserStackAutomateClient(bsCredentials)

    const build = `build-${crypto.randomUUID()}`
    const workerOptions: WorkerOptions[] = options.browsers.map((browser) => {
        const name = browser.name ?? generateNameForBrowser(browser)

        // Url precedence:
        const url =
            browser.url ??
            options.workerCommon?.url ??
            serverHandle.https?.url ??
            serverHandle.http!.url
        return {
            build,
            name,
            ...options.workerCommon,
            ...browser,
            url,
        }
    })

    const workerController = new BrowserStackWorkerController(
        { client },
        workerOptions,
        options
    )
    configureReportingApi(app, workerController)
    const state = workerController.state

    function createProgressMessage() {
        let failedStr = `failed: ${state.failed}`
        if (state.failed > 0) failedStr = ansi.red + failedStr + ansi.resetColor
        return (
            `${ansi.green}passed: ${state.passed}${ansi.resetColor}, ${failedStr}, running: ${state.running}, pending: ${state.pending}\n` +
            progressBar(state.percentComplete)
        )
    }

    let previousDecile = 0
    workerController.onUpdate = () => {
        if (disposed) return
        const progressStr = createProgressMessage()
        if (useSticky) logger.sticky(progressStr)
        else {
            const decile = Math.trunc(state.percentComplete * 10)
            if (decile !== previousDecile) {
                logger.info(progressStr)
                previousDecile = decile
            }
        }
        if (options.stopOnFirstFailure && state.failed) void shutdown()
        if (!state.remaining) void shutdown()
    }

    const sigIntHandler = () => {
        logger.info('SIGINT signal received.')
        void shutdown().then(() => {
            process.exit(1)
        })
    }
    process.once('SIGINT', sigIntHandler)

    let disposed = false
    async function shutdown() {
        if (disposed) return
        disposed = true
        logger.clearSticky()
        logger.info(createProgressMessage())

        logger.debug('Shutting down')
        process.removeListener('SIGINT', sigIntHandler)

        await workerController.terminate()
        await serverHandle.close()
        await shutdownLocalTunnel()
        // Resolve the promise with the final results:
        const passed = workerController.allPassed
        if (passed) logger.info('✅ All tests passed')
        done({
            passed,
        })
    }
    workerController.start()
    return await donePromise
}

/**
 * Creates a session name for the given browser options.
 */
function generateNameForBrowser(browser: BrowserDetails): string {
    return [
        browser.device,
        browser.os,
        browser.os_version,
        browser.browser,
        browser.browser_version,
    ]
        .filter((str) => str)
        .join(' ')
}

/**
 * Calls {@link runBrowserStack}, exiting the process when settled.
 * @param options
 */
export function runBrowserStackAndExit(options: BrowserStackOptions): void {
    runBrowserStack(options)
        .then((result) => {
            if (!result.passed) process.exit(1)
        })
        .catch((error: any) => {
            console.error(
                ansi.red +
                    String('message' in error ? error.message : error) +
                    ansi.resetColor
            )
            process.exit(1)
        })
}
