/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    LoudnessNormalizationController,
    LoudnessNormalizationControllerEventMap,
} from '@amazon/vinyl'

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<LoudnessNormalizationController>()

export class MockLoudnessNormalizationController
    extends MockEventHost<LoudnessNormalizationControllerEventMap>
    implements LoudnessNormalizationController
{
    gain = 1.0
    setTrackLoudness = spyFactory('setTrackLoudness')
    clear = spyFactory('clear')
}
