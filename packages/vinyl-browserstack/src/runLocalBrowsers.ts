/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express'
import {
    ansi,
    configureExpress,
    configureReportingApi,
    type DoneRequest,
    extractArgs,
    logger,
    type ProgressRequest,
    type ReportingListener,
    type ServerOptions,
    startExpressServer,
} from '@amazon/vinyl-build-utils'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
    type LocalBrowserName,
    type LocalBrowserPage,
    localBrowserNames,
    LocalBrowserUnavailableError,
    openLocalBrowser,
} from './localBrowsers'

export interface LocalBrowsersOptions {
    /**
     * Local server configuration, serving the test page.
     */
    readonly server: ServerOptions

    /**
     * The browsers to run. Default: all of {@link localBrowserNames}.
     */
    readonly browsers?: readonly LocalBrowserName[]

    /**
     * Runs the browsers one after another instead of all at once. Default: false
     */
    readonly serial?: boolean

    /**
     * Query parameters to add to the test page url, e.g. `spec` or `seed`.
     */
    readonly queryParams?: Readonly<Record<string, string>>

    /**
     * Shows the Playwright browser windows. Default: false
     */
    readonly headed?: boolean

    /**
     * The number of seconds a browser may take to run the suite. Default: 30 minutes
     */
    readonly timeout?: number

    /**
     * The directory to write each run's console logs to. Set to null to disable.
     * Default: ./integLogs
     */
    readonly logsDir?: string | null
}

export interface LocalBrowserResult {
    readonly browser: LocalBrowserName

    /**
     * 'skipped' if the browser is unavailable on this machine.
     */
    readonly status: 'passed' | 'failed' | 'skipped'

    /**
     * Why the browser failed or was skipped, if not a spec failure.
     */
    readonly reason: string | null

    /**
     * The suite's results, as reported by the page. Null if the suite did not finish.
     */
    readonly done: DoneRequest | null

    readonly durationMs: number

    /**
     * The log file path, if logs were written.
     */
    readonly logFile: string | null
}

export interface LocalBrowsersResults {
    readonly passed: boolean
    readonly results: readonly LocalBrowserResult[]
}

interface Session {
    readonly browser: LocalBrowserName
    readonly log: (lines: readonly string[]) => void
    totalSpecs: number
    totalCompleted: number
    lastRunningSpec: string | null
    resolveDone: (done: DoneRequest) => void
}

/**
 * Runs the in-browser Jasmine suite locally in real browsers, all at once from one server: Playwright's Chromium,
 * Firefox, and WebKit, and Safari through its own safaridriver. Each page's start prompt is clicked with trusted
 * input, and every spec runs (`stopOnSpecFailure=false`), so the results list all failures.
 */
export async function runLocalBrowsers(
    options: LocalBrowsersOptions
): Promise<LocalBrowsersResults> {
    const sessions = new Map<string, Session>()
    const listener: ReportingListener = {
        shouldHandleRequest: (id) => sessions.has(id),
        onStarted(request) {
            sessions.get(request.id)!.totalSpecs = request.totalSpecs
        },
        onProgress(request: ProgressRequest) {
            const session = sessions.get(request.id)!
            session.totalSpecs = request.totalSpecs
            session.totalCompleted = request.totalCompleted
            for (const [, , message] of request.logs) {
                if (message.startsWith('Running spec: '))
                    session.lastRunningSpec = message.slice(14)
            }
            session.log(request.logs.map((entry) => entry.join(' ')))
            if (process.stdout.isTTY)
                logger.sticky(
                    [...sessions.values()]
                        .map(
                            (s) =>
                                `${s.browser} ${s.totalCompleted}/${s.totalSpecs}`
                        )
                        .join('  ')
                )
        },
        onDone(request) {
            sessions.get(request.id)!.resolveDone(request)
        },
    }

    const app = express()
    configureExpress(app, options.server)
    configureReportingApi(app, listener)
    const serverHandle = await startExpressServer({ app }, options.server)
    const serverUrl = serverHandle.https?.url ?? serverHandle.http!.url

    const logsDir =
        options.logsDir === undefined ? './integLogs' : options.logsDir
    if (logsDir) fs.mkdirSync(logsDir, { recursive: true })

    const browsers = options.browsers ?? localBrowserNames
    const results: LocalBrowserResult[] = []
    const openPages = new Set<LocalBrowserPage>()
    // Quit safaridriver sessions too, which would otherwise outlive the process.
    const sigIntHandler = () => {
        logger.info('SIGINT signal received.')
        Promise.all([...openPages].map((page) => page.close()))
            .catch(() => {})
            .finally(() => process.exit(130))
    }
    process.once('SIGINT', sigIntHandler)
    try {
        const run = (browser: LocalBrowserName) =>
            runBrowser(browser).then((result) => {
                const counts: Partial<Record<string, number>> | undefined =
                    result.done?.statusCounts
                logger.info(
                    `[${browser}] ${result.status}` +
                        (counts
                            ? ` (${counts.passed ?? 0} passed, ${counts.failed ?? 0} failed)`
                            : '') +
                        ` in ${formatDuration(result.durationMs)}`
                )
                return result
            })
        if (options.serial) {
            for (const browser of browsers) results.push(await run(browser))
        } else {
            results.push(...(await Promise.all(browsers.map(run))))
        }
    } finally {
        process.removeListener('SIGINT', sigIntHandler)
        logger.clearSticky()
        await serverHandle.close()
    }

    async function runBrowser(
        browser: LocalBrowserName
    ): Promise<LocalBrowserResult> {
        const id = crypto.randomUUID()
        // Jasmine decodes query params with decodeURIComponent, which doesn't decode URLSearchParams' '+' spaces.
        const query = Object.entries({
            reportApi: `/report/${id}`,
            stopOnSpecFailure: 'false',
            ...options.queryParams,
        })
            .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
            .join('&')
        const url = `${serverUrl}/?${query}`

        const logFile = logsDir
            ? path.join(
                  logsDir,
                  `${browser}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
              )
            : null
        const log = (lines: readonly string[]) => {
            if (logFile && lines.length)
                fs.appendFileSync(logFile, lines.join('\n') + '\n')
        }
        let resolveDone!: (done: DoneRequest) => void
        const donePromise = new Promise<DoneRequest>(
            (resolve) => (resolveDone = resolve)
        )
        const session: Session = {
            browser,
            log,
            totalSpecs: 0,
            totalCompleted: 0,
            lastRunningSpec: null,
            resolveDone,
        }
        sessions.set(id, session)

        logger.info(`[${browser}] ${url}`)
        const start = Date.now()
        const result = (
            status: LocalBrowserResult['status'],
            reason: string | null,
            done: DoneRequest | null
        ): LocalBrowserResult => ({
            browser,
            status,
            reason,
            done,
            durationMs: Date.now() - start,
            logFile,
        })

        let page: LocalBrowserPage
        try {
            page = await openLocalBrowser(browser, url, {
                headed: options.headed ?? false,
                log: (message) =>
                    log([`${new Date().toISOString()} ${message}`]),
            })
        } catch (error) {
            sessions.delete(id)
            if (error instanceof LocalBrowserUnavailableError) {
                logger.warn(
                    `${ansi.yellow}[${browser}] skipped: ${error.message}${ansi.resetColor}`
                )
                return result('skipped', error.message, null)
            }
            return result('failed', String(error), null)
        }
        openPages.add(page)
        const timeout = options.timeout ?? 30 * 60
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        try {
            const clickFailed = page.clickStartPrompt().then((shown) => {
                if (shown) logger.info(`[${browser}] clicked the start prompt`)
                return new Promise<never>(() => {})
            })
            const done = await Promise.race([
                donePromise,
                clickFailed,
                new Promise<null>((resolve) => {
                    timeoutId = setTimeout(() => resolve(null), timeout * 1000)
                }),
            ])
            if (!done) {
                const running = session.lastRunningSpec
                return result(
                    'failed',
                    `Timed out after ${timeout}s at ${session.totalCompleted}/${session.totalSpecs} specs` +
                        (running ? `, running '${running}'` : ''),
                    null
                )
            }
            const passed =
                done.overallStatus === 'passed' &&
                !done.failures?.length &&
                done.totalCompleted === done.totalSpecs
            return result(
                passed ? 'passed' : 'failed',
                passed ? null : done.reason || null,
                done
            )
        } catch (error) {
            return result('failed', String(error), null)
        } finally {
            clearTimeout(timeoutId)
            sessions.delete(id)
            openPages.delete(page)
            await page.close().catch(() => {})
        }
    }

    printResults(results)
    return {
        passed: results.every((r) => r.status !== 'failed'),
        results,
    }
}

function formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000)
    return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

function printResults(results: readonly LocalBrowserResult[]) {
    const rows = [
        [
            'Browser',
            'Result',
            'Specs',
            'Passed',
            'Failed',
            'Pending',
            'Time',
            'Seed',
        ],
        ...results.map((r) => {
            const counts: Partial<Record<string, number>> =
                r.done?.statusCounts ?? {}
            return [
                r.browser,
                r.status,
                r.done ? `${r.done.totalCompleted}/${r.done.totalSpecs}` : '-',
                String(counts.passed ?? '-'),
                String(counts.failed ?? '-'),
                String((counts.pending ?? 0) + (counts.excluded ?? 0) || '-'),
                formatDuration(r.durationMs),
                r.done?.seed ?? '-',
            ]
        }),
    ]
    const widths = rows[0].map((_, i) =>
        Math.max(...rows.map((row) => row[i].length))
    )
    const lines = rows.map((row) =>
        row.map((cell, i) => cell.padEnd(widths[i])).join('  ')
    )
    logger.info('\n' + lines.join('\n'))

    for (const r of results) {
        if (r.status === 'passed') continue
        const color = r.status === 'skipped' ? ansi.yellow : ansi.red
        if (r.reason && !r.done?.failures?.length)
            logger.info(
                `${color}${r.browser} ${r.status}: ${r.reason}${ansi.resetColor}`
            )
        for (const failure of r.done?.failures ?? []) {
            logger.info(
                `${color}✗ ${r.browser}: ${failure.fullName}${ansi.resetColor}\n` +
                    failure.messages.map((m) => `    ${m}`).join('\n')
            )
        }
        if (r.status === 'failed' && r.logFile && fs.existsSync(r.logFile))
            logger.info(`  Logs: ${r.logFile}`)
    }
}

/**
 * Calls {@link runLocalBrowsers}, exiting the process with a non-zero code if any browser failed.
 *
 * Command line arguments override the options: `--browsers=chromium,webkit`, `--serial`, and `--headed`. Any other
 * `--name=value` argument is added to the test page's query parameters, e.g. `--spec=progressive`.
 */
export function runLocalBrowsersAndExit(options: LocalBrowsersOptions): void {
    const { properties } = extractArgs(process.argv.slice(2))
    const {
        browsers,
        headed: _headed,
        serial: _serial,
        ...queryParams
    } = properties
    const browserNames = browsers
        ? browsers.split(',').map((name) => {
              if (!localBrowserNames.includes(name as LocalBrowserName))
                  throw new Error(
                      `Unknown browser '${name}', expected one of: ${localBrowserNames.join(', ')}`
                  )
              return name as LocalBrowserName
          })
        : options.browsers
    runLocalBrowsers({
        ...options,
        ...(browserNames && { browsers: browserNames }),
        headed: 'headed' in properties || (options.headed ?? false),
        serial: 'serial' in properties || (options.serial ?? false),
        queryParams: {
            ...options.queryParams,
            ...queryParams,
        },
    })
        .then((result) => process.exit(result.passed ? 0 : 1))
        .catch((error: unknown) => {
            const message =
                error instanceof Error ? error.message : String(error)
            console.error(ansi.red + message + ansi.resetColor)
            process.exit(1)
        })
}
