/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrackFactory, TrackLoadOptions } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

export class MockTrackFactory<
    TrackLoadOptionsType extends TrackLoadOptions = TrackLoadOptions,
> implements TrackFactory<TrackLoadOptionsType>
{
    private readonly spyFactory =
        createSpyFactory<TrackFactory<TrackLoadOptionsType>>()

    validate = this.spyFactory('validate')
    createTrack = this.spyFactory('createTrack')
}
