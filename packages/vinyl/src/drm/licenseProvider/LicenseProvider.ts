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

    /**
     * Identifies the license service, so the Widevine service certificate it
     * returns (when a CDM asks for one) answers later sessions' requests, in
     * this and the page's other players, without a round trip. Defaults to
     * {@link url}; set it for a custom license provider without a URL.
     * Without either, each session's request goes to the service.
     */
    readonly serviceCertificateKey?: Maybe<string>
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
        serviceCertificateKey: string().maybe().optional(),
    })
