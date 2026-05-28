/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    Maybe,
    Mutable,
    MutableRequestParams,
    ReadonlyAbort,
    RequestInitOptions,
    RequestInterceptor,
    Timestamp,
} from '@amazon/vinyl-util'
import {
    getHostname,
    last,
    networkMetricsController,
    normalizeHeadersInit,
    requestWithRetry,
} from '@amazon/vinyl-util'
import { type ByteRange, stringifyByteRange } from '@amazon/vinyl-mpd-parser'
import type { SegmentDataProvider } from '../streaming/SegmentDataSlot'

export interface CreateSegmentDataProviderDeps {
    readonly requestInterceptor: RequestInterceptor
    readonly segmentRequestInit: Maybe<RequestInitOptions>
}

export interface CreateSegmentDataProviderOptions {
    readonly url: string
    readonly mediaRange?: Maybe<ByteRange>
    readonly serviceId?: Maybe<string>
    /**
     * If true, reports downlink transfer speeds to network metrics.
     */
    readonly reportDownlinkMetrics: boolean
}

export function createSegmentDataProvider(
    deps: CreateSegmentDataProviderDeps,
    options: CreateSegmentDataProviderOptions
): SegmentDataProvider {
    return async (abort?: Maybe<ReadonlyAbort>) => {
        const init: Mutable<RequestInitOptions> = {
            ...deps.segmentRequestInit,
        }
        if (options.mediaRange) {
            init.headers = {
                ...normalizeHeadersInit(init.headers),
                Range: `bytes=${stringifyByteRange(options.mediaRange)}`,
            }
        }

        const params: MutableRequestParams = {
            input: options.url,
            init,
        }
        deps.requestInterceptor(params)

        const serviceId = options.serviceId ?? getHostname(options.url)
        const requestStart = Date.now()
        const response = await requestWithRetry(params.input, params.init, {
            serviceId,
            abort,
        })
        const responseEnd = Date.now()

        const arrayBuffer = await response.arrayBuffer()
        const contentEnd = Date.now()

        let responseStart: Timestamp | null = null
        if ('getEntriesByName' in performance) {
            const lastRequest: any = last(
                performance.getEntriesByName(params.input)
            )
            if (lastRequest) {
                // Resource timing information was available, use it to get a more accurate response start time. A
                // value of 0 means timing information was denied, likely due to a cross-origin request without
                // Timing-Allow-Origin response headers.
                if (lastRequest.responseStart) {
                    responseStart =
                        performance.timeOrigin + lastRequest.responseStart
                }
            }
        }

        if (options.reportDownlinkMetrics) {
            networkMetricsController.value.addDownlinkTransferEntry({
                bytes: arrayBuffer.byteLength,
                serviceId,
                requestStart,
                responseStart,
                responseEnd,
                contentEnd,
            })
        }
        return arrayBuffer
    }
}
