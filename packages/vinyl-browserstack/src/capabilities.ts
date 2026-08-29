/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    BrowserStackCredentials,
    WorkerOptions,
} from '@amazon/vinyl-build-utils'

/**
 * BrowserStack-specific WebDriver capabilities, nested under `bstack:options`
 * per the W3C protocol.
 * @see https://www.browserstack.com/docs/automate/capabilities
 */
export interface BStackOptions {
    os?: string
    osVersion?: string
    deviceName?: string
    realMobile?: boolean
    sessionName?: string
    buildName?: string
    projectName?: string
    resolution?: string
    video?: boolean
    networkLogs?: boolean
    consoleLogs?: 'disable' | 'errors' | 'warnings' | 'info' | 'verbose'
    local?: boolean
    userName?: string
    accessKey?: string
    seleniumVersion?: string
}

/**
 * W3C WebDriver capabilities for a BrowserStack session.
 */
export interface WebDriverCapabilities {
    browserName: string
    browserVersion?: string
    'bstack:options': BStackOptions
}

/**
 * Infers the WebDriver `browserName` for a mobile device from its OS: Android
 * devices run Chrome, iOS devices run Safari.
 */
function mobileBrowserName(os: string): string {
    return os.toLowerCase() === 'ios' ? 'safari' : 'chrome'
}

/**
 * Builds W3C WebDriver capabilities from framework-agnostic {@link WorkerOptions}.
 *
 * Credentials are placed in `bstack:options` (not the hub URL) so they never
 * leak into logged request URLs. `local: true` routes the session through the
 * BrowserStack Local tunnel. `consoleLogs: 'verbose'` populates the dashboard
 * Console Logs tab (Chrome only; harmless elsewhere).
 */
export function buildCapabilities(
    workerOptions: WorkerOptions,
    credentials: BrowserStackCredentials
): WebDriverCapabilities {
    const isMobile = workerOptions.device != null

    const bstackOptions: BStackOptions = {
        osVersion: workerOptions.os_version,
        video: workerOptions.video ?? true,
        networkLogs: workerOptions.networkLogs ?? false,
        consoleLogs: 'verbose',
        local: true,
        userName: credentials.username,
        accessKey: credentials.key,
        // Only set when defined — `exactOptionalPropertyTypes` forbids
        // assigning `undefined` to an optional property.
        ...(workerOptions.name != null && { sessionName: workerOptions.name }),
        ...(workerOptions.build != null && { buildName: workerOptions.build }),
        ...(workerOptions.project != null && {
            projectName: workerOptions.project,
        }),
    }

    if (isMobile) {
        bstackOptions.deviceName = workerOptions.device!
        bstackOptions.realMobile = true
    } else {
        bstackOptions.os = workerOptions.os
        // `resolution` is a desktop-only capability.
        if (workerOptions.resolution)
            bstackOptions.resolution = workerOptions.resolution
    }

    const browserName = isMobile
        ? mobileBrowserName(workerOptions.os)
        : workerOptions.browser!

    const capabilities: WebDriverCapabilities = {
        browserName,
        'bstack:options': bstackOptions,
    }
    // browserVersion applies to desktop browsers only.
    if (!isMobile && workerOptions.browser_version)
        capabilities.browserVersion = workerOptions.browser_version

    return capabilities
}
