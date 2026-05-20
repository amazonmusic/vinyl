/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    EMPTY_NETWORK_METRICS,
    getNetworkMetrics,
    networkMetricsController,
} from '@amazon/vinyl-util'
import {
    MockNetworkMetricsController,
    overrideGlobalInit,
} from '@amazon/vinyl-util/testUtil'

describe('getNetworkMetrics', () => {
    overrideGlobalInit(
        networkMetricsController,
        () => new MockNetworkMetricsController()
    )
    it('returns the global network metrics', () => {
        expect(getNetworkMetrics()).toEqual(EMPTY_NETWORK_METRICS)
    })
})
