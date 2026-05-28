/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Maybe, type ReadonlyAbort } from '@amazon/vinyl-util'
import type { DrmKeySystem } from '../DrmKeySystem'
import {
    any,
    instanceOf,
    object,
    type ObjectSchema,
    string,
} from '@amazon/vinyl-validation'

/**
 * LicenseProvider handles requesting DRM licenses for specific key systems.
 */
export type LicenseProvider = (
    keySystem: DrmKeySystem,
    serverOptions: LicenseServerOptions,
    challenge: ArrayBuffer,
    abort?: ReadonlyAbort
) => Promise<ArrayBuffer>

/**
 * Basic license server configuration.
 * The license provider is given the matching configuration for the selected
 * key system.
 */
export interface LicenseServerOptions {
    /**
     * The license server URL.
     * This is required when using the default license provider.
     */
    readonly url?: Maybe<string | URL>

    /**
     * License request init options.
     */
    readonly init?: Maybe<RequestInit>

    /**
     * If set, provides the server certificate.
     * An ArrayBufferLike object containing the server certificate.
     * The contents are Key System-specific.
     * If a `string` is provided, the value will be considered to be Base 64.
     */
    readonly serverCertificate?: Maybe<ServerCertificate>
}

/**
 * An ArrayBufferLike object containing the server certificate.
 * The contents are Key System-specific.
 * If a `string` is provided, the value will be considered to be Base 64.
 */
export type ServerCertificate = ArrayBuffer | string

export const licenseServerOptionsValidator: ObjectSchema<LicenseServerOptions> =
    object({
        url: string().or(instanceOf(URL)).maybe().optional(),
        init: object({}).cast<RequestInit>().maybe().optional(),
        serverCertificate: any().optional(),
    })
