/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Local as BsLocal, type Options } from 'browserstack-local'
import { logger } from '../util/Logger'
import fs from 'node:fs'
import path from 'path'

export function startBrowserStackLocal(
    options: Partial<Options>
): Promise<() => Promise<void>> {
    if (options.logFile)
        fs.mkdirSync(path.dirname(options.logFile), { recursive: true })
    return new Promise((resolve, reject) => {
        const bsLocal = new BsLocal()
        logger.info('Starting BrowserStackLocal...')
        bsLocal.start(options, (error) => {
            if (error) {
                reject(error)
                return
            }
            logger.info('Started BrowserStackLocal')
            // The binary runs as a detached daemon (`--daemon start`) that
            // outlives this process, and `stop()` signals it asynchronously. If
            // the process exits first (e.g. a second Ctrl+C, or process.exit()
            // during teardown), terminate the daemon synchronously on exit.
            const killOnExit = () => killBsLocalSync(bsLocal)
            process.once('exit', killOnExit)
            resolve(() =>
                closeBsLocal(bsLocal).finally(() =>
                    process.removeListener('exit', killOnExit)
                )
            )
        })
    })
}

/**
 * Promisifies closing the local connection.
 */
function closeBsLocal(bsLocal: BsLocal): Promise<void> {
    return new Promise((resolve) => {
        logger.debug('Stopping BrowserStackLocal...')
        bsLocal.stop(() => {
            logger.debug('Stopped BrowserStackLocal')
            resolve()
        })
    })
}

/**
 * Sends SIGTERM to the BrowserStackLocal daemon, if it was started. Synchronous,
 * so it can run from an `exit` handler.
 */
function killBsLocalSync(bsLocal: BsLocal): void {
    // `pid` is set by browserstack-local once the daemon connects, but isn't typed.
    const { pid } = bsLocal as BsLocal & { readonly pid?: number }
    if (!pid) return
    try {
        process.kill(pid, 'SIGTERM')
    } catch {
        // Already gone.
    }
}
