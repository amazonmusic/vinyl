/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BrowserStackOptions } from '../browserstack/browserStackConfig.js'
import { vinylSupportedBrowsers } from './vinylSupportedBrowsers.js'

/**
 * Defaults for browserstack configuration in Vinyl related projects. Without
 * credentials, the run reads them from the environment when it starts.
 */
export const vinylDefaultBrowserStackOptions = {
    browsers: vinylSupportedBrowsers,
    server: {
        http: { port: 9000 },
        staticDir: './dist/test',
        addressInUseAutoIncrement: true,
    },
    stopOnFirstFailure: true,
    workerCommon: {
        video: false,
        timeout: 30 * 60, // 30 minutes (BrowserStack maximum)
    },
    worker: {
        queryParams: {
            vinylLogLevel: 'debug',
        },
    },
} as const satisfies Partial<BrowserStackOptions>
