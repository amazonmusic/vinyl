/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getSearchParams,
    initializeLogging as initializeVinylLogging,
    logInfo,
    LogLevel,
    parseLogLevel,
} from '@amazon/vinyl-util'
import { configureVinylGlobal } from '@amazon/vinyl'

const target = { logPrefix: 'App' }

export function initializeLogging() {
    initializeVinylLogging()
    const logLevelParam = getSearchParams().get('logLevel') ?? 'warn'
    const logLevel: LogLevel | null = parseLogLevel(logLevelParam)
    if (logLevel != null) {
        configureVinylGlobal({
            logging: {
                logLevel: Math.min(LogLevel.DEBUG, logLevel),
                console: {
                    logLevel,
                },
            },
        })
    }
    logInfo(target, 'Amazon Vinyl Demo')
}
