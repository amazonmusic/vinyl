/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmKeySystem, drmProtectionValidator } from '@amazon/vinyl'

describe('drmProtectionValidator', () => {
    it('validates a complete DrmProtection', () => {
        expect(
            drmProtectionValidator.isValid({
                keySystem: DrmKeySystem.WIDEVINE,
                pssh: 'abc',
                pro: 'def',
            })
        ).toBeTrue()
    })

    it('allows optional pssh and pro to be omitted', () => {
        expect(
            drmProtectionValidator.isValid({
                keySystem: DrmKeySystem.FAIR_PLAY_1_0,
            })
        ).toBeTrue()
    })

    it('allows optional pssh and pro to be null', () => {
        expect(
            drmProtectionValidator.isValid({
                keySystem: DrmKeySystem.WIDEVINE,
                pssh: null,
                pro: null,
            })
        ).toBeTrue()
    })

    it('allows optional pssh and pro to be undefined', () => {
        expect(
            drmProtectionValidator.isValid({
                keySystem: DrmKeySystem.WIDEVINE,
                pssh: undefined,
                pro: undefined,
            })
        ).toBeTrue()
    })

    it('rejects missing keySystem', () => {
        expect(drmProtectionValidator.isValid({})).toBeFalse()
    })

    it('rejects invalid keySystem', () => {
        expect(drmProtectionValidator.isValid({ keySystem: 123 })).toBeFalse()
    })
})
