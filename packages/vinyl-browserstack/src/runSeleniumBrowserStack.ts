/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express'
import {
    ansi,
    type BrowserDetails,
    type BrowserStackOptions,
    BrowserStackAutomateClient,
    configureExpress,
    configureReportingApi,
    getEnvBrowserStackCredentials,
    logger,
    LogLevel,
    progressBar,
    startBrowserStackLocal,
    startExpressServer,
    type WorkerOptions,
} from '@amazon/vinyl-build-utils'
import type { Options as BsLocalOptions } from 'browserstack-local'
import { WebDriverWorkerController } from './WebDriverWorkerController'
import crypto from 'node:crypto'

/**
 * When the BrowserStack run has completed, provides the final results.
 */
export interface BrowserStackResults {
    readonly passed: boolean
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
 * Runs an in-browser Jasmine suite across BrowserStack real browsers over
 * Selenium/WebDriver.
 *
 * This will:
 * - Start a local server, including the reporter REST API the in-browser suite
 *   posts progress/logs to.
 * - Start the BrowserStack Local tunnel.
 * - Build a real WebDriver session per browser (parallelized to the account's
 *   available session budget) and navigate each to the test URL.
 *
 * The transport is WebDriver (`hub-cloud.browserstack.com/wd/hub`); the
 * in-browser reporter contract (per-spec pass/fail, `bStackLogs/<sessionId>.log`)
 * is unchanged.
 *
 * @return the aggregate test results.
 */
export async function runSeleniumBrowserStack(
    options: BrowserStackOptions
): Promise<BrowserStackResults> {
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

    const useSticky = options.stickyProgress ?? process.stdout.isTTY
    logger.level = options.logLevel ?? LogLevel.INFO

    const localOptions: Partial<BsLocalOptions> = {
        key: bsCredentials.key,
        logFile: './bStackLogs/local.log',
        ...options.local,
    }
    const shutdownLocalTunnel = await startBrowserStackLocal(localOptions)

    const app = express()
    configureExpress(app, options.server)
    const serverHandle = await startExpressServer({ app }, options.server)

    const client = new BrowserStackAutomateClient(bsCredentials)

    const build = `build-${crypto.randomUUID()}`
    const workerOptions: WorkerOptions[] = options.browsers.map((browser) => {
        const name = browser.name ?? generateNameForBrowser(browser)
        let url =
            browser.url ??
            options.workerCommon?.url ??
            serverHandle.https?.url ??
            serverHandle.http!.url
        // Safari and iOS do not route `localhost` through the BrowserStack Local
        // tunnel; they must reach the test server via `bs-local.com`.
        if (browser.browser === 'safari' || browser.os === 'ios') {
            url = url.replace('//localhost', '//bs-local.com')
        }
        return { build, name, ...options.workerCommon, ...browser, url }
    })

    const workerController = new WebDriverWorkerController(
        { client, credentials: bsCredentials },
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
        void shutdown().then(() => process.exit(1))
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
        const passed = workerController.allPassed
        if (passed) logger.info('✅ All tests passed')
        done({ passed })
    }
    workerController.start()
    return await donePromise
}

/**
 * Calls {@link runSeleniumBrowserStack}, exiting the process when settled.
 */
export function runSeleniumBrowserStackAndExit(
    options: BrowserStackOptions
): void {
    runSeleniumBrowserStack(options)
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
