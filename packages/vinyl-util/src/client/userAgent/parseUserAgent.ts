/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@/util/type'
import { defaultUserAgentRules } from './defaultUserAgentRules'
import type { UserAgentRules } from './tokenizeUserAgent'
import { tokenizeUserAgent } from './tokenizeUserAgent'
import type { UaDeviceInfo, UaSystemInfo, UserAgentInfo } from './UserAgentInfo'
import { emptyUserAgentInfo } from './UserAgentInfo'
import { globalRef } from '@/global/globalRegistry'

/**
 * Parses the user agent into a {@link UserAgentInfo} object.
 *
 * @param userAgent The User Agent. Default: `navigator.userAgent`.
 * @param rules The user agent rules.
 */
export function parseUserAgent(
    userAgent: Maybe<string> = undefined,
    rules: UserAgentRules = defaultUserAgentRules
): UserAgentInfo {
    if (userAgent === undefined && typeof navigator === 'object')
        userAgent = navigator.userAgent
    if (!userAgent) return emptyUserAgentInfo
    const tokenizedUa = tokenizeUserAgent(userAgent)

    let browserInfo: UaSystemInfo | null = null
    for (const rule of rules.browserRules) {
        browserInfo = rule(tokenizedUa)
        if (browserInfo) break
    }

    let browserLikeInfo: UaSystemInfo | null = null
    for (const rule of rules.browserLikeRules) {
        browserLikeInfo = rule(tokenizedUa, browserInfo)
        if (browserLikeInfo) break
    }

    let osInfo: UaSystemInfo | null = null
    for (const rule of rules.osRules) {
        osInfo = rule(tokenizedUa)
        if (osInfo) break
    }

    let osLikeInfo: UaSystemInfo | null = null
    for (const rule of rules.osLikeRules) {
        osLikeInfo = rule(tokenizedUa, osInfo)
        if (osLikeInfo) break
    }

    let deviceInfo: UaDeviceInfo | null = null
    for (const rule of rules.deviceRules) {
        deviceInfo = rule(tokenizedUa)
        if (deviceInfo) break
    }

    return {
        userAgent,
        browser: browserInfo,
        browserLike: browserLikeInfo,
        os: osInfo,
        osLike: osLikeInfo,
        device: deviceInfo,
    }
}

export const userAgentInfoRef = globalRef(() => parseUserAgent())

export function getUserAgentInfo(): UserAgentInfo {
    return userAgentInfoRef.value
}

export function setUserAgent(value: string) {
    userAgentInfoRef.reset()
    userAgentInfoRef.set(() => parseUserAgent(value))
}
