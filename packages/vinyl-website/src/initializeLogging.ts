/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    consoleLogHandler,
    getSearchParams,
    initializeLogging as initializeVinylLogging,
    logInfo,
    type LogLevel,
    parseLogLevel,
    setLogLevel,
} from '@amazon/vinyl-util'

const target = { logPrefix: 'App' }

export function initializeLogging() {
    initializeVinylLogging()
    const logLevelParam = getSearchParams().get('logLevel') ?? 'warn'
    const logLevel: LogLevel | null = parseLogLevel(logLevelParam)
    if (logLevel != null) {
        setLogLevel(logLevel)
        const cLH = consoleLogHandler.value
        if (cLH) cLH.logLevel = logLevel
    }
    logInfo(target, 'Amazon Vinyl Demo')
}
