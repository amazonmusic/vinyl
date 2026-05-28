/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    NetworkMetrics,
    NetworkMetricsController,
    NetworkMetricsEventMap,
} from '@amazon/vinyl-util'
import { EMPTY_NETWORK_METRICS } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

import { MockEventHost } from '../event/MockEventHost'

const spyFactory = createSpyFactory<NetworkMetricsController>()
export class MockNetworkMetricsController
    extends MockEventHost<NetworkMetricsEventMap>
    implements NetworkMetricsController
{
    maxHistorySize = 0

    metrics: NetworkMetrics = EMPTY_NETWORK_METRICS

    addMetricsEntry = spyFactory('addMetricsEntry')

    getServiceMetrics = spyFactory('getServiceMetrics')

    addDownlinkTransferEntry = spyFactory('addDownlinkTransferEntry')
}
