/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalRef, type Maybe } from '@amazon/vinyl-util'
import { DrmKeySystem } from './DrmKeySystem'
import type { LicenseServerOptions } from './licenseProvider/LicenseProvider'

/**
 * Widevine's service certificate request: the message a Widevine CDM sends,
 * before its license request, when its media keys have no server certificate.
 * A license server answers it with its service certificate.
 */
export const WIDEVINE_SERVICE_CERTIFICATE_REQUEST: ArrayBuffer = new Uint8Array(
    [0x08, 0x04]
).buffer

/**
 * Whether a key message is a Widevine CDM's service certificate request.
 */
export function isWidevineServiceCertificateRequest(
    keySystem: DrmKeySystem,
    message: ArrayBuffer
): boolean {
    if (keySystem !== DrmKeySystem.WIDEVINE) return false
    const bytes = new Uint8Array(message)
    const request = new Uint8Array(WIDEVINE_SERVICE_CERTIFICATE_REQUEST)
    return (
        bytes.length === request.length &&
        bytes.every((b, i) => b === request[i])
    )
}

/**
 * Identifies the license service whose service certificate applies to a
 * session: {@link LicenseServerOptions.serviceCertificateKey}, else the license
 * server URL. Null when neither is known, in which case the certificate isn't
 * shared.
 */
export function serviceCertificateKey(
    keySystem: DrmKeySystem,
    options: LicenseServerOptions
): string | null {
    const id = options.serviceCertificateKey ?? options.url?.toString()
    return id ? `${keySystem} ${id}` : null
}

/**
 * License services' answers to Widevine service certificate requests, by
 * {@link serviceCertificateKey}, shared by the page's players: a later
 * session's request is answered with one instead of a round trip. In memory only:
 * a license service may rotate its certificate, and a page's lifetime bounds
 * how long a rotated one is used (a license request using it fails, and drops
 * it from the cache).
 */
export const serviceCertificateCacheRef = globalRef(
    () => new Map<string, ArrayBuffer>()
)

/** Clears the shared service certificates (see {@link serviceCertificateCacheRef}). */
export function clearServiceCertificateCache(): void {
    serviceCertificateCacheRef.value.clear()
}

/** The cached service certificate for `key`, if any. */
export function getCachedServiceCertificate(
    key: Maybe<string>
): ArrayBuffer | null {
    return key == null
        ? null
        : (serviceCertificateCacheRef.value.get(key) ?? null)
}
