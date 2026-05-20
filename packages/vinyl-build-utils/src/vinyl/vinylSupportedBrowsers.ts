/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkerInitOptions } from '../browserstack/runBrowserStack'

/**
 * Notes:
 * Firefox for Windows does not accept our root CA on BrowserStack.
 * Firefox (any OS) does not run in a secure context with localhost.
 * Firefox for macOS does accept our root CA.
 * iOS redirects localhost to bs-local.com and must use HTTPS.
 *
 * Tests that require a secure context (DRM) are expected to be skipped if one cannot be
 * established.
 *
 * https should be true for browsers that accept our root CA and are not in a secure context when
 * using localhost.
 *
 * @module
 */

export const vinylSupportedBrowsers: readonly WorkerInitOptions[] = [
    {
        browser: 'chrome',
        browser_version: 'latest',
        os: 'OS X',
        os_version: 'Monterey',
    },

    {
        browser: 'safari',
        browser_version: 'latest',
        os: 'OS X',
        os_version: 'Sonoma',
    },

    {
        browser: 'firefox',
        browser_version: 'latest',
        os: 'Windows',
        os_version: '10',
    },

    // Mobile

    {
        device: 'Samsung Galaxy S23 Ultra',
        os: 'android',
        os_version: '13.0',
    },

    {
        device: 'iPhone 13',
        os: 'ios',
        os_version: '17',
    },

    {
        device: 'iPhone 15 Pro Max',
        os: 'ios',
        os_version: '17',
    },
] as const
