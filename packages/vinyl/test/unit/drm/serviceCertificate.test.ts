/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    clearServiceCertificateCache,
    DrmKeySystem,
    getCachedServiceCertificate,
    isWidevineServiceCertificateRequest,
    serviceCertificateCacheRef,
    serviceCertificateKey,
} from '@amazon/vinyl'

describe('serviceCertificate', () => {
    describe('isWidevineServiceCertificateRequest', () => {
        it("matches Widevine's two-byte request", () => {
            const request = new Uint8Array([0x08, 0x04]).buffer
            expect(
                isWidevineServiceCertificateRequest(
                    DrmKeySystem.WIDEVINE,
                    request
                )
            ).toBeTrue()
            expect(
                isWidevineServiceCertificateRequest(
                    DrmKeySystem.PLAY_READY,
                    request
                )
            ).toBeFalse()
        })

        it('does not match a license request', () => {
            for (const bytes of [[0x08], [0x08, 0x05], [0x08, 0x04, 0x01]]) {
                expect(
                    isWidevineServiceCertificateRequest(
                        DrmKeySystem.WIDEVINE,
                        new Uint8Array(bytes).buffer
                    )
                ).toBeFalse()
            }
        })
    })

    describe('serviceCertificateKey', () => {
        it('prefers serviceCertificateKey over the url', () => {
            expect(
                serviceCertificateKey(DrmKeySystem.WIDEVINE, {
                    url: 'https://a.example',
                    serviceCertificateKey: 'dmls',
                })
            ).toBe(`${DrmKeySystem.WIDEVINE} dmls`)
        })

        it('falls back to the url, string or URL', () => {
            expect(
                serviceCertificateKey(DrmKeySystem.WIDEVINE, {
                    url: new URL('https://a.example/license'),
                })
            ).toBe(`${DrmKeySystem.WIDEVINE} https://a.example/license`)
        })

        it('is null for an unidentified service', () => {
            expect(serviceCertificateKey(DrmKeySystem.WIDEVINE, {})).toBeNull()
        })
    })

    describe('cache', () => {
        afterEach(() => clearServiceCertificateCache())

        it('looks up and clears certificates', () => {
            const certificate = new Uint8Array([1]).buffer
            serviceCertificateCacheRef.value.set('k', certificate)
            expect(getCachedServiceCertificate('k')).toBe(certificate)
            expect(getCachedServiceCertificate('other')).toBeNull()
            expect(getCachedServiceCertificate(null)).toBeNull()
            clearServiceCertificateCache()
            expect(getCachedServiceCertificate('k')).toBeNull()
        })
    })
})
