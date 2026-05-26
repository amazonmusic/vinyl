/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyEventHost } from '@/event/EventHost'
import type { AnyRecord, Maybe } from '@/util/type'
import type {
    NetworkMetrics,
    NetworkMetricsEntry,
    NetworkTransferEntry,
    ServiceMetrics,
} from './networkMetricsModel'

export interface NetworkMetricsEventMap {
    /**
     * The network metrics state has changed.
     */
    readonly metricsChange: AnyRecord
}

export interface ReadonlyNetworkMetricsController extends ReadonlyEventHost<NetworkMetricsEventMap> {
    /**
     * The current metrics state.
     * The returned object is static at the time of request.
     */
    readonly metrics: NetworkMetrics

    /**
     * Returns metrics for the given service id.
     * If the service id is nullish, or there is no history for the given service, empty service
     * metrics will be returned.
     *
     * The returned object is static at the time of request.
     *
     * @param serviceId
     */
    getServiceMetrics(serviceId: Maybe<string>): ServiceMetrics
}

export interface NetworkMetricsController extends ReadonlyNetworkMetricsController {
    /**
     * Adds information about a completed settled request.
     * Note: This does not update estimated bandwidth.
     * @param entry
     */
    addMetricsEntry(entry: NetworkMetricsEntry): void

    /**
     * Adds information about a completed downlink content transfer.
     *
     * @param entry
     */
    addDownlinkTransferEntry(entry: NetworkTransferEntry): void
}
