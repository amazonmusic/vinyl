/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Version } from '../Version'

/**
 * A parsed user agent.
 */
export interface UserAgentInfo {
    readonly userAgent: string
    readonly browser: UaSystemInfo | null
    readonly browserLike: UaSystemInfo | null
    readonly device: UaDeviceInfo | null
    readonly os: UaSystemInfo | null
    readonly osLike: UaSystemInfo | null
}

/**
 * Platform or system information.
 */
export interface UaSystemInfo {
    readonly name: string
    readonly version: Version | null
}

/**
 * Device information from the user agent.
 */
export interface UaDeviceInfo {
    readonly vendor: string | null
    readonly model: string | null
    readonly type: string | null
}

export const emptyUserAgentInfo = {
    userAgent: '',
    browser: null,
    browserLike: null,
    os: null,
    osLike: null,
    device: null,
} as const satisfies UserAgentInfo
