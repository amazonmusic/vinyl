/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Browser } from './defaultUserAgentRules'
import { getUserAgentInfo } from './parseUserAgent'
import type { UserAgentInfo } from './UserAgentInfo'
import type { Version } from '../Version'
import { compareVersions, parseVersion } from '../Version'
import type { Maybe } from '../../util/type'

export interface HasBrowserOptions {
    /**
     * If true (default), checks both {@link UserAgentInfo.browserLike} (first) and
     * {@link UserAgentInfo.browser} for a name match.
     */
    readonly checkBrowserLike?: boolean

    /**
     * The parsed user agent to query. Default is the browser's parsed user agent.
     */
    readonly userAgentInfo?: UserAgentInfo
}

/**
 * Returns true if the current user agent matches the given browser.
 *
 * @param browser
 * @param minVersionStr If provided, only returns true if the browser version is at least this version.
 * Must be parsable by {@link parseVersion}.
 * @param maxVersionStr If provided, only returns true if the browser version is at most this version.
 * Must be parsable by {@link parseVersion}.
 * @param options Additional optional configuration.
 */
export function hasBrowser(
    browser: Browser,
    minVersionStr?: Maybe<string>,
    maxVersionStr?: Maybe<string>,
    options?: HasBrowserOptions
): boolean {
    const userAgent = options?.userAgentInfo ?? getUserAgentInfo()
    const systemInfo =
        (options?.checkBrowserLike ?? true) &&
        userAgent.browserLike?.name === browser
            ? userAgent.browserLike
            : userAgent.browser?.name === browser
              ? userAgent.browser
              : null
    if (systemInfo == null) return false

    let atMostMaxVersion = false
    if (!maxVersionStr) atMostMaxVersion = true
    else {
        // When a maxVersionStr has been provided, consider null sub-versions to always match.
        // For example maxVersionStr 53 will match the version 53.1.234, but 53.0 would not.
        const maxInt = Number.MAX_SAFE_INTEGER
        const maxVersion = parseVersion(maxVersionStr)
        const finalMaxVersion = {
            major: maxVersion.major,
            minor: maxVersion.minor ?? maxInt,
            patch: maxVersion.patch ?? maxInt,
            build: maxVersion.build ?? maxInt,
            str: '',
        } as const satisfies Version
        atMostMaxVersion =
            compareVersions(systemInfo.version, finalMaxVersion) <= 0
    }

    return (
        (minVersionStr == null ||
            compareVersions(systemInfo.version, parseVersion(minVersionStr)) >=
                0) &&
        atMostMaxVersion
    )
}
