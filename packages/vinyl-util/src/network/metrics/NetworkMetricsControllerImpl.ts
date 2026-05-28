/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventHostImpl } from '../../event/EventHost'
import type { NetworkInformation } from '../browser/NetworkInformation'
import type {
    NetworkMetricsController,
    NetworkMetricsEventMap,
} from './NetworkMetricsController'
import type {
    NetworkMetrics,
    NetworkMetricsEntry,
    NetworkTransferEntry,
    ServiceMetrics,
    StatMetrics,
} from './networkMetricsModel'
import {
    EMPTY_NETWORK_METRICS,
    EMPTY_SERVICE_METRICS,
} from './networkMetricsModel'
import { lerp } from '../../util/math/math'
import { clone } from '../../util/object/clone'
import type { ReadonlyDeep } from '../../util/object/readonlyType'
import type { Mutable, MutableDeep } from '../../util/object/mutableType'
import { getOrSetProp } from '../../util/object/object'
import type { Maybe } from '../../util/type'
import { logVerbose } from '../../logging/Logger'
import type { Timestamp } from '../../util/date/date'
import { throttle, type ThrottledCallback } from '../../util/fun/throttle'
import { createDisposer } from '../../core/disposable'
import { UnionRanges } from '../../util/range/UnionRanges'
import type { Range } from '../../util/range/Ranges'
import { rangesOf } from '../../util/range/Ranges'

/*
 * Worldwide customer bandwidth for all devices was obtained using:
 *
 * select PERCENTILE_CONT(0.10) within group (order by transfer_speed_bps) as P10
 * from amevents.o_business_event_t3mnths t
 * where t.event_type = 'streamingTerminated'
 * and t.transfer_speed_bps > 0
 *
 * This yielded 276,376 bytes per second, or 2,211,008 bits per second.
 */

export interface NetworkMetricsControllerImplOptions {
    /**
     * The smoothing factor for EWMA (Exponential Moving Weighted Average), used in
     * bandwidth and response time moving averages.
     *
     * The purpose is to give more weight to recent events than old events, while keeping
     * calculations simple and avoiding the need to keep histories as a rolling average would.
     *
     * This value should be between 0 and 1.
     * The closer to 1 this value is, the more weight new values have.
     * A value of 0.2 for example would mean that after 10 updates, the current average after
     * ten new data points would influence the new average by (1-0.2)^10 ≈ 10% and the latest
     * update would influence the average by 20%.
     */
    readonly ewmaSmoothing: number

    /**
     * For biased values such as ewmaHigh/ewmaLow, when the value is in the direction of the
     * bias, this smoothing will be used.
     * This should be a value between 0 and 1 and be more than bias negative smoothing.
     */
    readonly ewmaBiasPositiveSmoothing: number

    /**
     * For biased values such as ewmaHigh/ewmaLow, when the value is not in the direction of the
     * bias, this smoothing will be used.
     * This should be a value between 0 and 1 and be less than bias positive smoothing.
     */
    readonly ewmaBiasNegativeSmoothing: number

    /**
     * When the user's bandwidth cannot be determined due to lack of NetworkInformation support
     * and no reported downlink history, then this value will be used.
     * This should be in bits per second.
     */
    readonly unknownDownlinkBandwidthEstimate: number

    /**
     * Maximum bandwidth in bps we will attribute to any single measurement.
     * Transfers measured above this are clamped; zero-duration transfers are
     * treated as this speed rather than discarded.
     * Default: 30_000_000
     */
    readonly maxMeasuredBandwidthBps: number

    /**
     * Time window (in seconds) for amortizing network transfer entries in bandwidth estimation.
     *
     * This window enables accurate bandwidth calculation across multiple concurrent streams
     * (audio, video, etc.) by aggregating transfer data over time.
     *
     * - Too low: Streams won't be properly combined, leading to inaccurate estimates
     * - Too high: Bandwidth estimation becomes slow to adapt to network changes
     *
     * @default 4
     */
    readonly bandwidthEstimationWindow: number
}

/**
 * Default configuration for NetworkMetricsControllerImpl
 */
export const defaultNetworkMetricsControllerImplOptions = {
    ewmaSmoothing: 0.2,
    ewmaBiasNegativeSmoothing: 0.1,
    ewmaBiasPositiveSmoothing: 0.5,

    // Using the p10 value for customer bandwidth worldwide, which should be enough bandwidth for
    // 90% of customers. This is high enough for HD content, but not UHD.
    unknownDownlinkBandwidthEstimate: 2_200_000,

    maxMeasuredBandwidthBps: 30_000_000,
    bandwidthEstimationWindow: 4,
} as const satisfies NetworkMetricsControllerImplOptions

export interface NetworkMetricsControllerImplDependencies {
    readonly networkInformation?: Maybe<NetworkInformation>
}

export class NetworkMetricsControllerImpl
    extends EventHostImpl<NetworkMetricsEventMap>
    implements NetworkMetricsController
{
    private _metrics: MutableDeep<NetworkMetrics> = clone(EMPTY_NETWORK_METRICS)

    /**
     * A clone of _metrics, copied on read after a change.
     * @private
     */
    private _metricsSnapshot = EMPTY_NETWORK_METRICS
    private hasChanged = false

    private readonly options: NetworkMetricsControllerImplOptions
    private readonly transferEntries: NetworkTransferEntry[] = []
    private readonly refreshEstimatedBandwidthThrottled: ThrottledCallback

    private readonly disposer = createDisposer()

    constructor(
        private readonly deps: NetworkMetricsControllerImplDependencies,
        options?: Partial<NetworkMetricsControllerImplOptions>
    ) {
        super()
        const { add } = this.disposer
        this.options = {
            ...defaultNetworkMetricsControllerImplOptions,
            ...options,
        }
        this.onDownloadSpeedChange()
        this.deps.networkInformation?.addEventListener(
            'change',
            this.onDownloadSpeedChange
        )
        add(() => {
            this.deps.networkInformation?.removeEventListener(
                'change',
                this.onDownloadSpeedChange
            )
        })

        this.refreshEstimatedBandwidthThrottled = add(
            throttle(
                this.refreshEstimatedBandwidth,
                this.options.bandwidthEstimationWindow,
                {
                    leading: false,
                    trailing: true,
                }
            )
        )
    }

    get [Symbol.toStringTag](): string {
        return 'NetworkMetricsControllerImpl'
    }

    get metrics(): NetworkMetrics {
        if (this.hasChanged) {
            this.hasChanged = false
            this._metricsSnapshot = clone(this._metrics)
        }
        return this._metricsSnapshot
    }

    getServiceMetrics(serviceId: Maybe<string>): ReadonlyDeep<ServiceMetrics> {
        if (serviceId == null) return EMPTY_SERVICE_METRICS
        return this.metrics.serviceMetrics[serviceId] ?? EMPTY_SERVICE_METRICS
    }

    addMetricsEntry(entry: NetworkMetricsEntry): void {
        const metrics = this._metrics

        if (entry.serviceId) {
            const serviceMetrics = getOrSetProp(
                metrics.serviceMetrics,
                entry.serviceId,
                () => clone(EMPTY_SERVICE_METRICS)
            )
            updateServiceMetrics(serviceMetrics, entry, this.options)
        }
        updateServiceMetrics(metrics.totals, entry, this.options)
        this.notifyMetricsChange()
    }

    private readonly refreshEstimatedBandwidth = () => {
        const ranges: Range[] = []
        let bytes = 0
        for (const entry of this.transferEntries) {
            const start = estimateResponseStart(entry)
            const end = entry.contentEnd
            ranges.push([start, end])
            bytes += entry.bytes
        }
        this.transferEntries.length = 0

        const union = new UnionRanges([rangesOf(ranges)])
        let time = Number.MIN_VALUE
        for (const [start, end] of union) {
            time += (end - start) / 1000
        }

        const bps = Math.min(
            (bytes * 8) / time,
            this.options.maxMeasuredBandwidthBps
        )
        updateStatMetrics(
            this._metrics.estimatedDownlinkBandwidth,
            bps,
            this.options
        )
        logVerbose(
            this,
            'addDownlinkTransferEntry',
            this._metrics.estimatedDownlinkBandwidth
        )
        this.notifyMetricsChange()
    }

    addDownlinkTransferEntry(entry: NetworkTransferEntry): void {
        if (entry.bytes <= 0) return
        this.transferEntries.push(entry)
        this.refreshEstimatedBandwidthThrottled()
    }

    private onDownloadSpeedChange = () => {
        const downlink = this.deps.networkInformation?.downlink // mbps
        const estimatedSpeed = downlink
            ? downlink * 1024 * 1024 // bps
            : this.options.unknownDownlinkBandwidthEstimate
        updateStatMetrics(
            this._metrics.estimatedDownlinkBandwidth,
            estimatedSpeed,
            this.options
        )
        this.notifyMetricsChange()
    }

    private notifyMetricsChange() {
        this.hasChanged = true
        this.dispatch('metricsChange', {})
    }

    dispose() {
        super.dispose()
        this.disposer.dispose()
    }
}

/**
 * Updates totals and consecutive counts for the service metrics.
 */
function updateServiceMetrics(
    serviceMetrics: MutableDeep<ServiceMetrics>,
    entry: NetworkMetricsEntry,
    options: NetworkMetricsControllerImplOptions
) {
    const totals = entry.ok
        ? serviceMetrics.successTotals
        : serviceMetrics.failureTotals
    totals.totalCount++
    totals.consecutiveCount++
    if (entry.responseTime) {
        updateStatMetrics(
            serviceMetrics.responseTime,
            entry.responseTime,
            options
        )
    }
    if (entry.ok) serviceMetrics.failureTotals.consecutiveCount = 0
    else serviceMetrics.successTotals.consecutiveCount = 0
    if (entry.retryAfter)
        serviceMetrics.retryAfter = Math.max(
            serviceMetrics.retryAfter ?? 0,
            entry.retryAfter
        )
}

function updateStatMetrics(
    statMetrics: Mutable<StatMetrics>,
    newValue: number,
    options: NetworkMetricsControllerImplOptions
): void {
    if (!statMetrics.dataPoints) {
        statMetrics.min = newValue
        statMetrics.max = newValue
        statMetrics.average = newValue
        statMetrics.latest = newValue
        statMetrics.ewma = newValue
        statMetrics.ewmaHigh = newValue
        statMetrics.ewmaLow = newValue
        statMetrics.dataPoints = 1
        return
    }
    statMetrics.dataPoints++
    statMetrics.min = Math.min(statMetrics.min, newValue)
    statMetrics.max = Math.max(statMetrics.max, newValue)
    statMetrics.average = lerp(
        statMetrics.average,
        newValue,
        1 / statMetrics.dataPoints
    )
    statMetrics.latest = newValue

    // Weighted averages
    statMetrics.ewma = lerp(statMetrics.ewma, newValue, options.ewmaSmoothing)
    const highAlpha =
        newValue > statMetrics.ewmaHigh
            ? options.ewmaBiasPositiveSmoothing
            : options.ewmaBiasNegativeSmoothing
    statMetrics.ewmaHigh = lerp(statMetrics.ewmaHigh, newValue, highAlpha)

    const lowAlpha =
        newValue < statMetrics.ewmaLow
            ? options.ewmaBiasPositiveSmoothing
            : options.ewmaBiasNegativeSmoothing
    statMetrics.ewmaLow = lerp(statMetrics.ewmaLow, newValue, lowAlpha)
}

/**
 * Estimates the timestamp when the first response byte was received for a network transfer.
 *
 * When the browser's Resource Timing API provides `responseStart`, that value is used directly.
 * Otherwise, a logistic model estimates the latency fraction (the proportion of total
 * request time spent waiting for the first byte) from the transfer size and total duration.
 *
 * The model uses a sigmoid function parameterized on a feature combining `log(bytes)` and
 * `log(totalTime)`. Larger transfers relative to their duration are assumed to have a smaller
 * latency fraction (most time is spent downloading), while small or slow transfers are assumed
 * to be latency-dominated.
 *
 * `responseEnd` represents when the fetch promise settled (approximately when HTTP headers
 * arrived). This provides an upper bound on when the first byte was received — the actual
 * responseStart is at or before this point.
 *
 * @param entry - A completed network transfer entry with timing information.
 * @returns The estimated timestamp (ms since epoch) when the first response byte arrived.
 */
export function estimateResponseStart(entry: NetworkTransferEntry): Timestamp {
    if (entry.responseStart) return entry.responseStart
    // responseEnd is when the fetch settled (headers received), which is an upper bound on
    // when the first byte arrived. Use it as the estimate — the actual first byte is at or
    // slightly before this point, but never after it.
    if (entry.responseEnd <= entry.requestStart) return entry.requestStart
    const totalTime = entry.contentEnd - entry.requestStart
    if (totalTime === 0) return entry.requestStart
    // The sigmoid estimates what fraction of the total request-to-content time was spent
    // waiting (DNS, TCP, TLS, server processing) vs. receiving bytes.
    const feature = 0.2 * Math.log(entry.bytes) - Math.log(totalTime)
    const latencyFraction = 0.87 / (1 + Math.exp(-(feature + 3.8) / 0.3))
    // Clamp the estimate to not exceed responseEnd (when headers arrived).
    const estimated = entry.requestStart + latencyFraction * totalTime
    return Math.min(estimated, entry.responseEnd)
}
