/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type BrowserStackOptions,
    getEnvBrowserStackCredentials,
} from '../browserstack/runBrowserStack'
import { vinylSupportedBrowsers } from './vinylSupportedBrowsers'

/**
 * Defaults for browserstack configuration in Vinyl related projects.
 */
export const vinylDefaultBrowserStackOptions = {
    credentials: getEnvBrowserStackCredentials(),
    browsers: vinylSupportedBrowsers,
    server: {
        http: { port: 9000 },
        staticDir: './dist/test',
        addressInUseAutoIncrement: true,
    },
    stopOnFirstFailure: true,
    workerCommon: {
        video: true,
        timeout: 10 * 60, // 10 minutes
    },
    worker: {
        queryParams: {
            vinylLogLevel: 'debug',
        },
    },
} as const satisfies Partial<BrowserStackOptions>
