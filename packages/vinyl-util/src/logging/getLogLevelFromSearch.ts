/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getLocationSearch, getSearchParams } from '@/util/browser/searchParams'
import { LogLevel, parseLogLevel } from '@/logging/Logger'

/**
 * Returns the current vinyl logging level, as set by the querystring parameter: vinylLogLevel.
 * @param search
 * @param defaultLevel
 */
export function getLogLevelFromSearch(
    search: string = getLocationSearch(),
    defaultLevel: LogLevel = LogLevel.WARN
): LogLevel {
    const str = getSearchParams(search).get('vinylLogLevel')
    if (!str) return defaultLevel
    return parseLogLevel(str) ?? defaultLevel
}
