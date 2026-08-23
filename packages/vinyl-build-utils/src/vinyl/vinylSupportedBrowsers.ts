/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkerInitOptions } from '../browserstack/runBrowserStack'

// Each entry names a fallbackBrowser on a slightly different OS so a worker
// that can never establish a BrowserStack session (e.g. the local tunnel
// intermittently fails to connect for Safari on macOS) retries on a nearby
// platform rather than failing outright. Fallbacks stay within the same
// browser/device family and OS family.
export const vinylSupportedBrowsers: readonly WorkerInitOptions[] = [
    {
        browser: 'chrome',
        browser_version: 'latest',
        os: 'OS X',
        os_version: 'Tahoe',
        fallbackBrowser: {
            browser: 'chrome',
            browser_version: 'latest',
            os: 'OS X',
            os_version: 'Sequoia',
        },
    },

    {
        browser: 'safari',
        browser_version: 'latest',
        os: 'OS X',
        os_version: 'Tahoe',
        fallbackBrowser: {
            browser: 'safari',
            browser_version: 'latest',
            os: 'OS X',
            os_version: 'Sequoia',
        },
    },

    {
        browser: 'firefox',
        browser_version: 'latest',
        os: 'Windows',
        os_version: '11',
        fallbackBrowser: {
            browser: 'firefox',
            browser_version: 'latest',
            os: 'Windows',
            os_version: '10',
        },
    },

    // Mobile

    {
        device: 'Samsung Galaxy S23 Ultra',
        os: 'android',
        os_version: '13.0',
        fallbackBrowser: {
            device: 'Samsung Galaxy S22 Ultra',
            os: 'android',
            os_version: '12.0',
        },
    },

    {
        device: 'iPhone 15 Pro Max',
        os: 'ios',
        os_version: '17',
        fallbackBrowser: {
            device: 'iPhone 14 Pro Max',
            os: 'ios',
            os_version: '16',
        },
    },
] as const
