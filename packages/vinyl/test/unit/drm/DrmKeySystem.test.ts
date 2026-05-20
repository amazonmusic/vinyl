/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmKeySystem, isFairPlay, isPlayReady } from '@amazon/vinyl'

describe('isPlayReady', () => {
    it('returns true if key system is one of PlayReady key systems', () => {
        expect(isPlayReady(DrmKeySystem.PLAY_READY)).toBeTrue()
        expect(isPlayReady(DrmKeySystem.PLAY_READY_CHROMECAST)).toBeTrue()
        expect(isPlayReady(DrmKeySystem.PLAY_READY_RECOMMENDATION)).toBeTrue()
        expect(isPlayReady(DrmKeySystem.PLAY_READY_3000)).toBeTrue()
        expect(isPlayReady(DrmKeySystem.WIDEVINE)).toBeFalse()
        expect(isPlayReady(DrmKeySystem.FAIR_PLAY_1_0)).toBeFalse()
    })
})

describe('isFairPlay', () => {
    it('returns true if key system is one of FairPlay key systems', () => {
        expect(isFairPlay(DrmKeySystem.FAIR_PLAY)).toBeTrue()
        expect(isFairPlay(DrmKeySystem.FAIR_PLAY_1_0)).toBeTrue()
        expect(isFairPlay(DrmKeySystem.PLAY_READY_3000)).toBeFalse()
        expect(isFairPlay(DrmKeySystem.WIDEVINE)).toBeFalse()
    })
})
