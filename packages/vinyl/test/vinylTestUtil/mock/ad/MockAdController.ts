/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AdBreakInfo,
    AdController,
    AdInfo,
    TrackAds,
} from '../../../../src'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<AdController>()
export class MockAdController extends MockEventHost implements AdController {
    currentTrackAds: TrackAds | null = null
    currentAd: AdInfo | null = null
    currentAdBreak: AdBreakInfo | null = null

    setAdsProvider = spyFactory('setAdsProvider')
    failAd = spyFactory('failAd')
    skipAd = spyFactory('skipAd')
    skipAdBreak = spyFactory('skipAdBreak')
    enterPreroll = spyFactory('enterPreroll')
    enterPostroll = spyFactory('enterPostroll')

    constructor() {
        super()
        // enterPreroll/enterPostroll are awaited by the TrackController, so
        // default them to resolve with "no roll" (null); tests override with
        // resolveTo() as needed.
        this.enterPreroll.and.resolveTo(null)
        this.enterPostroll.and.resolveTo(null)
    }
}
