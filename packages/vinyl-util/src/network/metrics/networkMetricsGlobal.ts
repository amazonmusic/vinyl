/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalRef } from '../../global/globalRegistry'
import { getNetworkInformation } from '../browser/NetworkInformation'
import type { NetworkMetricsController } from './NetworkMetricsController'
import { NetworkMetricsControllerImpl } from './NetworkMetricsControllerImpl'
import type { NetworkMetrics } from './networkMetricsModel'

/**
 * A global reference to the network metrics controller.
 */
export const networkMetricsController = globalRef<NetworkMetricsController>(
    () =>
        new NetworkMetricsControllerImpl({
            networkInformation: getNetworkInformation(),
        })
)

/**
 * Returns the global network metrics.
 */
export function getNetworkMetrics(): NetworkMetrics {
    return networkMetricsController.value.metrics
}
