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

    clearCompletedAds = spyFactory('clearCompletedAds')
    failAd = spyFactory('failAd')
    setAds = spyFactory('setAds')
    skipAd = spyFactory('skipAd')
    enterPostroll = spyFactory('enterPostroll')
    skipAdBreak = spyFactory('skipAdBreak')
}
