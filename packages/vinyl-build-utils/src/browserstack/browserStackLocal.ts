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
            resolve(() => closeBsLocal(bsLocal))
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
