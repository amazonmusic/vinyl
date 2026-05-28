/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError } from '../error/IllegalArgumentError'
import { EventHostImpl } from '../event/EventHost'
import { globalRef } from '../global/globalRegistry'
import type { NetworkMetricsController } from './metrics/NetworkMetricsController'
import {
    type BackoffOptions,
    ErrorBodyType,
    type Fetch,
    type Requester,
    type RequestInitOptions,
    type RequestOptions,
} from './Requester'
import type {
    FetchRequestInfo,
    RequestAttemptInfo,
    RequestCaughtErrorEvent,
    RequestCompletedEvent,
    RequesterImplEventMap,
    RequestNetworkErrorEvent,
    RequestResponseErrorEvent,
    RequestSuccessEvent,
} from './RequesterImplEventMap'
import { RequestFailureType } from './RequesterImplEventMap'
import { RequestError } from './RequestError'
import {
    getResponseInfo,
    parseRetryAfter,
    retryAfterJitter,
    shouldRetry,
} from './requesterUtil'
import { withAbort } from '../util/async/abortUtils'
import { TimeoutController } from '../util/async/TimeoutController'
import { mergeDeep } from '../util/object/mergeDeep'
import { substitute } from '../util/string/string'
import { createShortUid } from '../util/string/uid'
import type { Maybe, PartialDeep } from '../util/type'
import { patchFetch } from '../patch/network/fetch'

/**
 * Request impl options configuring retry and timeout behavior.
 */
export interface RequesterImplOptions {
    /**
     * Retry configuration.
     */
    readonly retryOptions: RetryOptions

    /**
     * The timeout (in seconds) before the request is aborted.
     */
    readonly timeout: number
}

export interface RetryOptions {
    /**
     * The maximum number of retries for a single request.
     * Default: 1
     * For requests with side effects, this should be set to 0.
     *
     * "Various studies have collected data which shows that one max retry is sufficient to
     * achieve 99.999% success. The idea is that a truly transient failure should succeed on
     * the first retry.  And if the retry fails then it is likely more than a transient failure
     * and additional retries are exhausting resources in the system for no benefit."
     */
    readonly retries: number

    /**
     * The number of consecutive failures before retries are no longer attempted, only tries.
     */
    readonly retryFailureCutoff: number

    /**
     * Retry backoff timing.
     */
    readonly retryBackoff: BackoffOptions

    /**
     * First try backoff timing.
     */
    readonly tryBackoff: BackoffOptions

    /**
     * If there is a retry-after header, add the returned amount of time (in seconds) to prevent
     * clustered retry behavior.
     */
    readonly retryAfterJitter: () => number

    /**
     * Given the network status code, returns true if the fetch should retry.
     */
    readonly shouldRetry: (status: number) => boolean
}

/**
 * The minimum amount of time to leave for network calls. If the `max try time -
 * timeout` is less than this value, an IllegalArgumentError will be thrown.
 */
export const MIN_SERVICE_TIME = 10

/**
 * @private
 */
const locale = {
    tryBackoffTooSmall: 'timeout - tryBackoff.maxTime must be at least {value}',
    fetchNotFoundError: 'global fetch not found',
} as const

/**
 * Distribute requests across the last 50% of the exponential back-off time
 */
export function defaultBackoffDistribution(): number {
    return Math.random() * 0.5 + 0.5
}

/**
 * Calculates the timer delay according to an exponential back off strategy.
 *
 * @param failedCount The number of times the service has consecutively failed.
 * @param options Retry timing options (default values from:
 *   `defaultRetryOptions`)
 *
 * @returns The delay to retry a network request in seconds. This will be clamped
 *   between 1 and `options.maxRetryTime`.
 */
export function getBackoffTime(
    failedCount: number,
    options: BackoffOptions
): number {
    if (failedCount <= 0) return 0
    return (
        options.distribution() *
        Math.min(
            options.interval * Math.pow(options.exponentBase, failedCount - 1),
            options.maxTime
        )
    )
}

/**
 * Dependencies for {@link RequesterImpl}
 */
export interface RequesterImplDeps {
    readonly fetch: Fetch
    readonly networkMetricsController: NetworkMetricsController
}

export const RetryStrategy = {
    get NO_RETRIES(): RetryOptions {
        /**
         * Defaults for first try behavior.
         * Tries should have minimal throttling, enough to be a safety against aberrant client behavior
         * during a network outage.
         */
        const defaultTryBackoff: BackoffOptions = {
            exponentBase: 2,
            interval: 0.5,
            maxTime: 15,
            distribution: defaultBackoffDistribution,
        }

        /**
         * Defaults for retry behavior.
         */
        const defaultRetryBackoff: BackoffOptions = {
            exponentBase: 2,
            interval: 3,
            maxTime: 60,
            distribution: defaultBackoffDistribution,
        }

        return {
            retries: 0,
            retryBackoff: defaultRetryBackoff,
            retryFailureCutoff: 5,
            tryBackoff: defaultTryBackoff,
            retryAfterJitter,
            shouldRetry,
        }
    },

    get ONE_RETRY(): RetryOptions {
        return {
            ...this.NO_RETRIES,
            retries: 1,
        }
    },
}

/**
 * The return type of doRequest, contains the completion info and optional response.
 */
type RequestResult =
    | {
          readonly info: RequestSuccessEvent | RequestResponseErrorEvent
          readonly response: Response
      }
    | {
          readonly info: RequestCaughtErrorEvent | RequestNetworkErrorEvent
          readonly response: null
      }

/**
 * A quality of service wrapper to `global.fetch`.
 * Handles retries, network status, and emits events that may be used in reporting or metrics.
 */
export class RequesterImpl
    extends EventHostImpl<RequesterImplEventMap>
    implements Requester
{
    get [Symbol.toStringTag](): string {
        return 'RequesterImpl'
    }

    /**
     * Default values for fetch options.
     */
    private _options: RequesterImplOptions = {
        timeout: 60,
        retryOptions: RetryStrategy.NO_RETRIES,
    }

    constructor(protected readonly deps: RequesterImplDeps) {
        super()
    }

    /**
     * The current base options.
     * {@link request} may override these values.
     */
    get options(): RequesterImplOptions {
        return this._options
    }

    /**
     * Applies the given partial configuration.
     *
     * @param newOptions
     */
    configure(newOptions: PartialDeep<RequesterImplOptions>) {
        this._options = mergeDeep([this._options, newOptions])
    }

    async request(
        input: RequestInfo | Readonly<URL>,
        init?: Maybe<RequestInitOptions>,
        requestOptions?: Maybe<RequestOptions>
    ): Promise<Response> {
        requestOptions = requestOptions ?? {}
        const options = this._options
        const retryOptions = options.retryOptions
        if (
            options.timeout - retryOptions.tryBackoff.maxTime <
            MIN_SERVICE_TIME
        ) {
            throw new IllegalArgumentError(
                substitute(locale.tryBackoffTooSmall, {
                    value: MIN_SERVICE_TIME,
                })
            )
        }
        const timeoutController = new TimeoutController(
            options.timeout,
            requestOptions.abort
        )
        // Replace the request init to use the timeout controller's signal.
        const finalInit: RequestInit = {
            ...init,
            signal: timeoutController.nativeSignal,
        }

        const requestInfo: FetchRequestInfo = {
            requestId: createShortUid(),
            init: finalInit,
            input,
            maxRetries: retryOptions.retries,
            timestamp: Date.now(),
            requestOptions: {
                serviceId: requestOptions.serviceId ?? null,
                readErrorBody:
                    requestOptions.readErrorBody ?? ErrorBodyType.DISABLED,
            },
        }
        this.dispatch('request', { requestInfo })

        let lastResult: RequestResult | null = null
        let currentTry = 0
        do {
            ++currentTry
            const attemptInfo: RequestAttemptInfo = {
                currentTry,
                timestamp: Date.now(),
            }
            this.dispatch('requestAttemptStart', {
                requestInfo,
                attemptInfo,
            })
            lastResult = await this.doRequest(
                requestInfo,
                requestOptions,
                attemptInfo,
                timeoutController
            ).catch((reason) => {
                const completeInfo: RequestCaughtErrorEvent = {
                    ok: false,
                    type: requestOptions.abort?.aborted()
                        ? RequestFailureType.ABORT
                        : RequestFailureType.INTERNAL,
                    requestInfo,
                    reason,
                    willRetry: false,
                    timestamp: Date.now(),
                    retryAfter: null,
                }
                return { info: completeInfo, response: null } as const
            })
            timeoutController.dispose()
            this.reportMetricsEntry(lastResult.info)
            this.dispatch('requestAttemptComplete', lastResult.info)
        } while (!lastResult.info.ok && lastResult.info.willRetry)
        this.dispatch('requestComplete', lastResult.info)
        if (lastResult.info.ok) return lastResult.response!
        else throw new RequestError(lastResult.response, lastResult.info)
    }

    /**
     * Executes a single fetch.
     * If the request is aborted via `requestInfo.init.signal` the promise will be rejected with
     * the abort reason.
     *
     * @throws RequestError
     * @private
     */
    private async doRequest(
        requestInfo: FetchRequestInfo,
        requestOptions: RequestOptions,
        attemptInfo: RequestAttemptInfo,
        timeoutController: TimeoutController
    ): Promise<RequestResult> {
        const deps = this.deps
        const retryOptions = this._options.retryOptions

        const firstTry = attemptInfo.currentTry === 1
        const serviceId = requestInfo.requestOptions.serviceId
        const serviceMetrics =
            deps.networkMetricsController.getServiceMetrics(serviceId)
        const failedCount = serviceMetrics.failureTotals.consecutiveCount
        const lastTry =
            attemptInfo.currentTry === retryOptions.retries + 1 ||
            failedCount + 1 >= retryOptions.retryFailureCutoff
        if (serviceMetrics.retryAfter) {
            await timeoutController.sleep(
                // OK to give sleep negative values.
                // Immediately rejects if sleep duration is beyond the timeout.
                (serviceMetrics.retryAfter - Date.now()) / 1000 +
                    retryOptions.retryAfterJitter()
            )
        } else {
            const backoffTime = getBackoffTime(
                failedCount,
                firstTry ? retryOptions.tryBackoff : retryOptions.retryBackoff
            )
            await timeoutController.sleep(backoffTime)
        }

        // Modern browsers support request cancellation by providing an abortSignal.
        // Whether the browsers support request cancellation or not, we want to stop
        // waiting for the fetch when the signal is aborted.
        let failureReason: any = null
        const response: Response | null = await withAbort(
            deps.fetch(requestInfo.input, requestInfo.init).catch((reason) => {
                failureReason = reason
                return null
            }),
            requestOptions.abort
        )
        if (response?.ok)
            return {
                info: {
                    ok: true,
                    requestInfo,
                    attemptInfo,
                    responseInfo: getResponseInfo(response),
                    timestamp: Date.now(),
                },
                response,
            }

        const errorCommon = {
            ok: false,
            requestInfo,
            attemptInfo,
            timestamp: Date.now(),
        } as const
        if (response) {
            const shouldRetry = retryOptions.shouldRetry(response.status)
            let reason: any = null
            try {
                switch (requestInfo.requestOptions.readErrorBody) {
                    case ErrorBodyType.TEXT:
                        reason = await response.text()
                        break
                    case ErrorBodyType.JSON:
                        reason = await response.json()
                        break
                }
            } catch (e: any) {
                reason = `Failed to read error body: ${e}`
            }
            return {
                info: {
                    type: RequestFailureType.RESPONSE,
                    ...errorCommon,
                    reason,
                    responseInfo: getResponseInfo(response),
                    retryAfter: parseRetryAfter(
                        response.headers.get('retry-after')
                    ),
                    willRetry: shouldRetry && !lastTry,
                },
                response,
            }
        } else {
            if (
                failureReason?.name === 'AbortError' ||
                // Firefox:
                (failureReason &&
                    failureReason === requestOptions.abort?.reason)
            ) {
                return {
                    info: {
                        type: RequestFailureType.ABORT,
                        ...errorCommon,
                        reason: requestOptions.abort?.reason,
                        retryAfter: null,
                        willRetry: false,
                    },
                    response: null,
                }
            } else {
                return {
                    info: {
                        type: RequestFailureType.NETWORK,
                        ...errorCommon,
                        reason: failureReason,
                        retryAfter: null,
                        willRetry: !lastTry,
                    },
                    response: null,
                }
            }
        }
    }

    private reportMetricsEntry(event: RequestCompletedEvent) {
        // Do not add a metrics entry for aborts or non-response errors.
        if (!event.ok && event.type !== RequestFailureType.RESPONSE) return
        this.deps.networkMetricsController.addMetricsEntry({
            ok: event.ok,
            serviceId: event.requestInfo.requestOptions.serviceId,
            retryAfter: event.ok ? null : event.retryAfter,
            responseTime: event.ok
                ? (event.timestamp - event.requestInfo.timestamp) / 1000
                : null,
        })
    }
}

export const nativeFetchRef = globalRef<Fetch>(() => {
    if (typeof global.fetch !== 'function')
        return () => {
            throw new Error(locale.fetchNotFoundError)
        }
    const fetch = global.fetch.bind(global)
    return patchFetch(fetch)
})
