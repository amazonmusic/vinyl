/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Timestamp } from '@/util/date/date'
import type { ReadonlyRecord } from '@/util/object/readonlyType'
import type { Maybe } from '@/util/type'

/**
 * Statistics for service calls and content transfers.
 * Immutable
 */
export interface NetworkMetrics {
    /**
     * Totals for all service metrics, including requests without service ids.
     */
    readonly totals: ServiceMetrics

    /**
     * Requests that were made with a service id will have their statistics tracked in this map.
     * key - The serviceId provided to fetch options.
     * value - cumulative metrics for that service.
     */
    readonly serviceMetrics: ReadonlyRecord<string, ServiceMetrics>

    /**
     * The estimated client bandwidth. Uses data points from totals, network information downlink changes,
     * and the fallback P90 downlink estimate.
     */
    readonly estimatedDownlinkBandwidth: StatMetrics
}

export interface ServiceMetrics {
    /**
     * Metrics for OK responses.
     */
    readonly successTotals: ServiceTotals

    /**
     * Metrics for !OK responses.
     */
    readonly failureTotals: ServiceTotals

    /**
     * If the last request was !ok and there was a retry-after header, this will be set.
     */
    readonly retryAfter: Timestamp | null

    /**
     * Metrics describing the response timing for this service, in seconds.
     */
    readonly responseTime: StatMetrics
}

/**
 * Basic statistical values describing the distribution of a datapoint.
 */
export interface StatMetrics {
    /**
     * The lowest value this stat has recorded.
     */
    readonly min: number

    /**
     * The highest value this stat has recorded.
     */
    readonly max: number

    /**
     * The simple average.
     */
    readonly average: number

    /**
     * The last value recorded.
     */
    readonly latest: number

    /**
     * The Exponentially Weighted Moving Average, weighing lower values more than high.
     */
    readonly ewmaLow: number

    /**
     * The Exponentially Weighted Moving Average, weighing higher values more than low.
     */
    readonly ewmaHigh: number

    /**
     * The Exponentially Weighted Moving Average.
     */
    readonly ewma: number

    /**
     * The number of data points these averages represent.
     */
    readonly dataPoints: number
}

export interface ServiceTotals {
    /**
     * The number of consecutive results with this result.
     */
    readonly consecutiveCount: number

    /**
     * The total count with this result.
     */
    readonly totalCount: number
}

/**
 * Information about a completed request attempt.
 */
export interface NetworkMetricsEntry {
    /**
     * True if the request was successful.
     */
    readonly ok: boolean

    /**
     * The id of the service, or null.
     */
    readonly serviceId: string | null

    /**
     * If the request was !ok and there was a retry-after header, this will be set.
     */
    readonly retryAfter: Timestamp | null

    /**
     * The number of seconds the response took or null for no response.
     */
    readonly responseTime: number | null
}

/**
 * Information about a completed content transfer.
 */
export interface NetworkTransferEntry {
    /**
     * The id of the service, or null.
     */
    readonly serviceId: string | null

    /**
     * Timestamp when the request was initiated.
     */
    readonly requestStart: Timestamp

    /**
     * Timestamp when the first byte of the response was transferred.
     * This should only be provided if performance resource timing
     * is available.
     */
    readonly responseStart?: Maybe<Timestamp>

    /**
     * Timestamp when the response was received.
     */
    readonly responseEnd: Timestamp

    /**
     * Timestamp when the full response body was received.
     */
    readonly contentEnd: Timestamp

    /**
     * The content-length of the transfer.
     */
    readonly bytes: number
}

export const EMPTY_SERVICE_TOTALS: ServiceTotals = {
    consecutiveCount: 0,
    totalCount: 0,
} as const

export const EMPTY_STAT_METRICS: StatMetrics = {
    average: 0,
    dataPoints: 0,
    ewma: 0,
    ewmaHigh: 0,
    ewmaLow: 0,
    latest: 0,
    max: 0,
    min: 0,
} as const

export const EMPTY_SERVICE_METRICS: ServiceMetrics = {
    failureTotals: EMPTY_SERVICE_TOTALS,
    successTotals: EMPTY_SERVICE_TOTALS,
    retryAfter: null,
    responseTime: EMPTY_STAT_METRICS,
} as const

export const EMPTY_NETWORK_METRICS: NetworkMetrics = {
    serviceMetrics: {},
    totals: EMPTY_SERVICE_METRICS,
    estimatedDownlinkBandwidth: EMPTY_STAT_METRICS,
} as const

export const EMPTY_NETWORK_METRICS_ENTRY: NetworkMetricsEntry = {
    ok: false,
    retryAfter: null,
    serviceId: null,
    responseTime: null,
}
