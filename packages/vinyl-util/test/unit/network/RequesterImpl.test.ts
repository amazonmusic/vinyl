/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    type BackoffOptions,
    clone,
    defaultBackoffDistribution,
    EMPTY_SERVICE_METRICS,
    ErrorBodyType,
    type Fetch,
    getBackoffTime,
    isNode,
    type Maybe,
    MIN_SERVICE_TIME,
    nativeFetchRef,
    noop,
    type RequestCaughtErrorEvent,
    type RequestCompletedEvent,
    RequesterImpl,
    RequestError,
    requesterWithRetryRef,
    RequestFailureType,
    type RequestOptions,
    requestWithRetry,
    RetryStrategy,
    type ServiceTotals,
} from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import {
    MockNetworkMetricsController,
    MockRequester,
    setMockNavigator,
} from '@amazon/vinyl-util/testUtil'
import any = jasmine.any
import createSpy = jasmine.createSpy
import Expected = jasmine.Expected
import objectContaining = jasmine.objectContaining
import Spy = jasmine.Spy

describe('RequesterImpl module', () => {
    describe('defaultBackoffDistribution', () => {
        it('provides a distribution between 0.5 and 1.0', () => {
            const randomSpy = spyOn(Math, 'random')
            randomSpy.and.returnValue(0)
            expect(defaultBackoffDistribution()).toBe(0.5)
            randomSpy.and.returnValue(1)
            expect(defaultBackoffDistribution()).toBe(1)
        })
    })

    describe('getBackoffTime', () => {
        it('returns a capped exponential value', () => {
            const opts1: BackoffOptions = {
                exponentBase: 2,
                interval: 3,
                maxTime: 15 * 60,
                distribution: () => 1,
            }
            expect(getBackoffTime(0, opts1)).toBe(0)
            expect(getBackoffTime(1, opts1)).toBe(3)
            expect(getBackoffTime(2, opts1)).toBe(6)
            expect(getBackoffTime(3, opts1)).toBe(12)
            expect(getBackoffTime(4, opts1)).toBe(24)
            expect(getBackoffTime(9, opts1)).toBe(768)
            expect(getBackoffTime(10, opts1)).toBe(900)
            expect(getBackoffTime(10, opts1)).toBe(900)
        })

        it('multiplies by returned distribution', () => {
            const opts1: BackoffOptions = {
                exponentBase: 2,
                interval: 3,
                maxTime: 15 * 60,
                distribution: () => 0.5,
            }
            expect(getBackoffTime(1, opts1)).toBe(1.5)
            expect(getBackoffTime(2, opts1)).toBe(3)
            expect(getBackoffTime(3, opts1)).toBe(6)
            expect(getBackoffTime(4, opts1)).toBe(12)
            expect(getBackoffTime(9, opts1)).toBe(384)
            expect(getBackoffTime(10, opts1)).toBe(450)
            expect(getBackoffTime(11, opts1)).toBe(450)
        })
    })

    describe('RequesterImpl', () => {
        let mockOkResponse: Response
        let mock503Response: Response

        let networkMetricsController: MockNetworkMetricsController

        const clock = useMockTime()

        async function expectFailuresAtIntervals(
            failures: ServiceTotals,
            ...intervals: number[]
        ) {
            const delta = 0.01
            let expected = failures.consecutiveCount
            for (const interval of intervals) {
                if (interval <= 0) {
                    await clock.tick(0)
                } else {
                    await clock.tick(interval - delta)
                    expect(failures.consecutiveCount).toBe(expected)
                    await clock.tick(delta)
                }
                expect(failures.consecutiveCount).toBe(++expected)
            }
        }

        beforeEach(() => {
            networkMetricsController = new MockNetworkMetricsController()
            networkMetricsController.getServiceMetrics.and.returnValue(
                EMPTY_SERVICE_METRICS
            )

            mockOkResponse = new Response('', {
                status: 200,
                headers: {
                    'content-length': '100',
                },
            })

            mock503Response = new Response('', {
                status: 503,
            })
        })

        describe('request', () => {
            it('provides input and init to the window fetch', async () => {
                const fetch = createSpy('fetch').and.returnValue(
                    Promise.resolve(mockOkResponse)
                )
                const requester = new RequesterImpl({
                    networkMetricsController,
                    fetch,
                })
                const input = new URL('https://example.com')
                const init: RequestInit = {
                    method: 'post',
                }
                await requester.request(input, init)
                expect(fetch).toHaveBeenCalledOnceWith(
                    input,
                    objectContaining(init)
                )
            })

            describe('when a response is ok', () => {
                it('resolves the request', async () => {
                    const fetch: Fetch = () => Promise.resolve(mockOkResponse)
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    const response = await requester.request('')
                    expect(response).toBe(mockOkResponse)
                })

                it(`provides RequestSuccessInfo to the requestAttemptComplete and requestComplete handlers`, async () => {
                    const fetch: Fetch = () => Promise.resolve(mockOkResponse)
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    const attemptSpy = createSpy('requestAttemptCompleteSpy')
                    requester.on('requestAttemptComplete', attemptSpy)
                    const completeSpy = createSpy('requestCompleteSpy')
                    requester.on('requestComplete', completeSpy)
                    await requester.request('')
                    const expected: Expected<RequestCompletedEvent> =
                        objectContaining<RequestCompletedEvent>({
                            ok: true,
                            requestInfo: {
                                requestId: any(String),
                                init: any(Object),
                                input: '',
                                maxRetries: 0,
                                timestamp: 0,
                                requestOptions: {
                                    serviceId: null,
                                    readErrorBody: ErrorBodyType.DISABLED,
                                },
                            },
                            attemptInfo: {
                                currentTry: 1,
                                timestamp: 0,
                            },
                            responseInfo: {
                                ok: true,
                                redirected: false,
                                status: 200,
                                statusText: '',
                                type: any(String),
                                url: '',
                                contentLength: 100,
                            },
                            timestamp: 0,
                        })
                    expect(attemptSpy).toHaveBeenCalledOnceWith(expected)
                    expect(completeSpy).toHaveBeenCalledOnceWith(expected)
                })
            })

            describe('when responses are !ok', () => {
                it('retries requestOption.retries times', async () => {
                    const fetch = createSpy('fetch').and.returnValue(
                        Promise.resolve(mock503Response)
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    for (let i = 0; i < 4; i++) {
                        requester.configure({
                            retryOptions: {
                                retries: i,
                                tryBackoff: {
                                    interval: 0,
                                },
                                retryBackoff: {
                                    interval: 0,
                                },
                            },
                        })
                        await requester
                            .request('')
                            .catch((requestError: RequestError) => {
                                expect(requestError.response).not.toBeNull()
                                expect(requestError.message).toBe(
                                    `request failed, exhausted ${i + 1} tries`
                                )
                            })
                        expect(fetch).toHaveBeenCalledTimes(i + 1)
                        fetch.calls.reset()
                    }
                })

                it('waits an exponential backoff interval between failures', async () => {
                    const failMetrics = clone(EMPTY_SERVICE_METRICS)
                    const failures = failMetrics.failureTotals

                    const fetch = () => {
                        failures.consecutiveCount++
                        return Promise.resolve(mock503Response)
                    }
                    networkMetricsController.getServiceMetrics.and.returnValue(
                        failMetrics
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    requester.configure({
                        retryOptions: {
                            retries: 2, // 3 tries each fetch.
                            tryBackoff: {
                                interval: 3,
                                maxTime: 15,
                                exponentBase: 2,
                                distribution: () => 1,
                            },
                            retryBackoff: {
                                interval: 5,
                                maxTime: 60,
                                exponentBase: 2,
                                distribution: () => 1,
                            } as const,
                            retryFailureCutoff: 9999,
                        },
                        timeout: 99999,
                    })
                    const attemptCompleteSpy = createSpy('attemptComplete')
                    requester.on('requestAttemptComplete', attemptCompleteSpy)

                    // Try intervals:   0, 3,  6, 12, 15, 15, 15, 15
                    // Retry intervals: 0, 5, 10, 20, 40, 60, 60, 60
                    // With 3 tries per fetch the intervals will be: 0, 5, 10, 12, 40, 60, 15, 60, 60

                    const serviceId = 'example.com'

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(failures, 0, 5, 10),
                    ])

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(failures, 12, 40, 60),
                    ])

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(failures, 15, 60, 60),
                    ])
                })

                it('throws a RequestError', async () => {
                    const fetch = createSpy('fetch').and.returnValue(
                        Promise.resolve(mock503Response)
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    const expectedError: Expected<RequestError> =
                        objectContaining<RequestError>({
                            message: 'request failed, exhausted 1 tries',
                            response: mock503Response,
                        })

                    requester.configure({
                        retryOptions: {
                            retries: 0,
                        },
                    })
                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com')
                        ).toBeRejectedWith(expectedError),
                        clock.tick(0),
                    ])
                })
            })

            describe('when timeout minus tryBackoff.maxTime is less than MIN_SERVICE_TIME', () => {
                it('throws an IllegalArgumentError', async () => {
                    const fetch: Fetch = () => Promise.resolve(mockOkResponse)
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    requester.configure({
                        retryOptions: {
                            tryBackoff: {
                                maxTime: 11,
                            },
                        },
                        timeout: MIN_SERVICE_TIME + 10,
                    })
                    await expectAsync(
                        requester.request('')
                    ).toBeRejectedWithError(
                        'timeout - tryBackoff.maxTime must be at least 10'
                    )
                    requester.configure({
                        retryOptions: {
                            tryBackoff: {
                                maxTime: 9,
                            },
                        },
                        timeout: MIN_SERVICE_TIME + 10,
                    })
                    await expectAsync(requester.request('')).not.toBeRejected()
                })
            })

            describe('when a dependency throws an error', () => {
                it(`rejects the promise with a RequestError, where info is of type INTERNAL and emit requestAttemptComplete`, async () => {
                    const fetch: Fetch = () => Promise.resolve(mockOkResponse)
                    const reason = new Error('expected')
                    networkMetricsController.getServiceMetrics.and.callFake(
                        () => {
                            throw reason
                        }
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    const expectedInfo: Expected<RequestCaughtErrorEvent> =
                        objectContaining<RequestCaughtErrorEvent>({
                            ok: false,
                            type: RequestFailureType.INTERNAL,
                            reason,
                            retryAfter: null,
                            requestInfo: {
                                requestId: any(String),
                                init: any(Object),
                                input: '',
                                maxRetries: 0,
                                timestamp: any(Number),
                                requestOptions: {
                                    serviceId: null,
                                    readErrorBody: ErrorBodyType.DISABLED,
                                },
                            },
                            timestamp: any(Number),
                            willRetry: false,
                        })

                    const requestAttemptCompleteSpy = createSpy(
                        'requestAttemptCompleteSpy'
                    )
                    requester.on(
                        'requestAttemptComplete',
                        requestAttemptCompleteSpy
                    )
                    const requestCompleteSpy = createSpy('requestCompleteSpy')
                    requester.on('requestComplete', requestCompleteSpy)
                    await expectAsync(requester.request('')).toBeRejectedWith(
                        objectContaining({ info: expectedInfo })
                    )
                    expect(requestCompleteSpy).toHaveBeenCalledOnceWith(
                        expectedInfo
                    )
                    expect(requestAttemptCompleteSpy).toHaveBeenCalledOnceWith(
                        expectedInfo
                    )

                    const abort = new Abort()
                    await expectAsync(
                        requester.request('', null, {
                            abort,
                        })
                    ).toBeRejectedWith(objectContaining({ info: expectedInfo }))
                })
            })

            describe('abort', () => {
                async function expectRequestToAbort(
                    requester: RequesterImpl,
                    reason: any,
                    input: RequestInfo | URL = '',
                    init: RequestInit | null = null,
                    options?: Maybe<RequestOptions>
                ) {
                    const expectedInfo: Expected<RequestCaughtErrorEvent> =
                        objectContaining({
                            ok: false,
                            type: RequestFailureType.ABORT,
                            reason,
                            requestInfo: any(Object),
                            willRetry: false,
                        })

                    const requestAttemptCompleteSpy = createSpy(
                        'requestAttemptCompleteSpy'
                    )
                    requester.on(
                        'requestAttemptComplete',
                        requestAttemptCompleteSpy
                    )
                    const requestCompleteSpy = createSpy('requestCompleteSpy')
                    requester.on('requestComplete', requestCompleteSpy)
                    await expectAsync(
                        requester.request(input, init, options)
                    ).toBeRejectedWith(objectContaining({ info: expectedInfo }))
                    expect(requestCompleteSpy).toHaveBeenCalledOnceWith(
                        expectedInfo
                    )
                    expect(requestAttemptCompleteSpy).toHaveBeenCalledOnceWith(
                        expectedInfo
                    )
                }

                describe('when request rejects with an AbortError', () => {
                    it(`rejects the promise with a RequestError, where info is of type ABORT, and reason is requestOptions.abort.reason`, async () => {
                        const reason = new Error('expected reason')
                        const abort = new Abort()
                        spyOnProperty(abort, 'reason', 'get').and.returnValue(
                            reason
                        )
                        const fetch: Fetch = () =>
                            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                            Promise.reject({ name: 'AbortError' })

                        const requester = new RequesterImpl({
                            networkMetricsController,
                            fetch,
                        })
                        await expectRequestToAbort(
                            requester,
                            undefined,
                            '',
                            null
                        )

                        await expectRequestToAbort(
                            requester,
                            reason,
                            '',
                            null,
                            {
                                abort,
                            }
                        )
                    })
                })

                describe('when request rejects with the abort reason', () => {
                    it(`rejects the promise with a RequestError, where info is of type ABORT, and reason is requestOptions.abort.reason`, async () => {
                        const reason = new Error('expected reason')
                        const abort = new Abort()
                        spyOnProperty(abort, 'reason', 'get').and.returnValue(
                            reason
                        )
                        const fetch: Fetch = () => Promise.reject(reason)

                        const requester = new RequesterImpl({
                            networkMetricsController,
                            fetch,
                        })
                        await expectRequestToAbort(
                            requester,
                            reason,
                            '',
                            null,
                            {
                                abort,
                            }
                        )
                    })
                })

                describe('when aborted', () => {
                    it(`rejects the promise with a RequestError, where info is of type ABORT, and reason is requestOptions.abort.reason`, async () => {
                        const reason = new Error('expected reason')
                        const abort = new Abort()
                        const fetch: Fetch = () =>
                            Promise.resolve(mockOkResponse)
                        const requester = new RequesterImpl({
                            networkMetricsController,
                            fetch,
                        })
                        abort.abort(reason)
                        await expectRequestToAbort(
                            requester,
                            reason,
                            '',
                            {},
                            {
                                abort,
                            }
                        )
                    })
                })
            })

            describe('when request rejects with a non-AbortError', () => {
                it(`rejects the promise with a RequestError, where info is of type NETWORK, and reason is the caught reason`, async () => {
                    const reason = new Error('expected network reason')
                    const fetch = createSpy<Fetch>('fetch')
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    fetch.and.returnValue(Promise.reject(reason))
                    await expectAsync(requester.request('')).toBeRejectedWith(
                        objectContaining({
                            info: objectContaining({
                                type: RequestFailureType.NETWORK,
                                ok: false,
                                reason,
                            }),
                        })
                    )
                    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                    fetch.and.returnValue(Promise.reject())
                    await expectAsync(requester.request('')).toBeRejectedWith(
                        objectContaining({
                            info: objectContaining({
                                type: RequestFailureType.NETWORK,
                                ok: false,
                                reason: undefined,
                            }),
                        })
                    )
                })
            })

            describe('when a failed response has a retry-after header', () => {
                const retryAfterJitter = 3
                const retryAfterTime = 12
                const retryInterval = retryAfterTime + retryAfterJitter

                beforeEach(() => {
                    mock503Response = new Response('', {
                        status: 503,
                        headers: { 'retry-after': retryAfterTime.toString() },
                    })
                })
                it('does not request again until the timestamp has passed', async () => {
                    const failMetrics = clone(EMPTY_SERVICE_METRICS)
                    const failures = failMetrics.failureTotals

                    const fetch: Fetch = () => {
                        failures.consecutiveCount++
                        return Promise.resolve(mock503Response)
                    }
                    networkMetricsController.getServiceMetrics.and.returnValue(
                        failMetrics
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    requester.configure({
                        retryOptions: {
                            retries: 2, // 3 tries each fetch.
                            retryFailureCutoff: 9999,
                            tryBackoff: {
                                interval: 0,
                                distribution: () => 1,
                            },
                            retryBackoff: {
                                distribution: () => 1,
                            } as const,
                            retryAfterJitter: () => retryAfterJitter,
                        },
                    })
                    requester.on('requestAttemptComplete', (info) => {
                        if (
                            !info.ok &&
                            info.type === RequestFailureType.RESPONSE
                        ) {
                            failMetrics.retryAfter = info.retryAfter
                        }
                    })
                    const serviceId = 'example.com'

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(
                            failures,
                            0,
                            retryInterval,
                            retryInterval
                        ),
                    ])

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(
                            failures,
                            retryInterval,
                            retryInterval,
                            retryInterval
                        ),
                    ])
                })
            })

            describe('when requests have failed more than retryFailureCutoff times', () => {
                it('no longer attempts retries', async () => {
                    const failMetrics = clone(EMPTY_SERVICE_METRICS)
                    const failures = failMetrics.failureTotals
                    const fetch: Fetch = () => {
                        failures.consecutiveCount++
                        return Promise.resolve(mock503Response)
                    }
                    networkMetricsController.getServiceMetrics.and.returnValue(
                        failMetrics
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })
                    requester.configure({
                        retryOptions: {
                            retries: 3, // 4 tries each fetch.
                            retryFailureCutoff: 7,
                            tryBackoff: {
                                interval: 1,
                                exponentBase: 2,
                                maxTime: 256,
                                distribution: () => 1,
                            },
                            retryBackoff: {
                                interval: 1,
                                exponentBase: 2,
                                maxTime: 256,
                                distribution: () => 1,
                            } as const,
                        },
                        timeout: 9999,
                    })
                    const serviceId = 'example.com'

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(failures, 0, 1, 2, 4),
                    ])

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(failures, 8, 16, 32),
                    ])

                    await Promise.all([
                        expectAsync(
                            requester.request('https://example.com', null, {
                                serviceId,
                            })
                        ).toBeRejectedWith(any(RequestError)),
                        expectFailuresAtIntervals(failures, 64),
                    ])
                })
            })

            describe('when options.readErrorBody is TEXT', () => {
                it('provides the body text on the error info', async () => {
                    mock503Response = new Response('expected text', {
                        status: 503,
                    })
                    const fetch = createSpy('fetch').and.returnValue(
                        Promise.resolve(mock503Response)
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })

                    await expectAsync(
                        requester.request(
                            '',
                            {},
                            {
                                readErrorBody: ErrorBodyType.TEXT,
                            }
                        )
                    ).toBeRejectedWith(
                        objectContaining({
                            info: objectContaining({
                                type: RequestFailureType.RESPONSE,
                                reason: 'expected text',
                            }),
                        })
                    )
                })
            })

            describe('when options.readErrorBody is JSON', () => {
                it('provides the body json on the error info', async () => {
                    mock503Response = new Response(
                        JSON.stringify({ foo: 'bar' }),
                        {
                            status: 503,
                        }
                    )
                    const fetch = createSpy('fetch').and.returnValue(
                        Promise.resolve(mock503Response)
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })

                    await expectAsync(
                        requester.request(
                            '',
                            {},
                            {
                                readErrorBody: ErrorBodyType.JSON,
                            }
                        )
                    ).toBeRejectedWith(
                        objectContaining({
                            info: objectContaining({
                                type: RequestFailureType.RESPONSE,
                                reason: { foo: 'bar' },
                            }),
                        })
                    )
                })

                it('sets reason to error message when response.json() throws', async () => {
                    mock503Response = new Response('not json', {
                        status: 503,
                    })
                    const fetch = createSpy('fetch').and.returnValue(
                        Promise.resolve(mock503Response)
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })

                    await expectAsync(
                        requester.request(
                            '',
                            {},
                            {
                                readErrorBody: ErrorBodyType.JSON,
                            }
                        )
                    ).toBeRejectedWith(
                        objectContaining({
                            info: objectContaining({
                                type: RequestFailureType.RESPONSE,
                                reason: jasmine.stringMatching(
                                    /Failed to read error body:/
                                ),
                            }),
                        })
                    )
                })
            })

            describe('when options.readErrorBody is TEXT', () => {
                it('sets reason to error message when response.text() throws', async () => {
                    mock503Response = new Response(null, { status: 503 })
                    spyOn(mock503Response, 'text').and.rejectWith(
                        new TypeError('body read error')
                    )
                    const fetch = createSpy('fetch').and.returnValue(
                        Promise.resolve(mock503Response)
                    )
                    const requester = new RequesterImpl({
                        networkMetricsController,
                        fetch,
                    })

                    await expectAsync(
                        requester.request(
                            '',
                            {},
                            {
                                readErrorBody: ErrorBodyType.TEXT,
                            }
                        )
                    ).toBeRejectedWith(
                        objectContaining({
                            info: objectContaining({
                                type: RequestFailureType.RESPONSE,
                                reason: jasmine.stringMatching(
                                    /Failed to read error body:/
                                ),
                            }),
                        })
                    )
                })
            })
        })

        describe('options', () => {
            it('returns the current options', () => {
                const fetch: Fetch = () => Promise.resolve(mockOkResponse)
                const requester = new RequesterImpl({
                    networkMetricsController,
                    fetch,
                })
                requester.configure({
                    timeout: 1,
                })
                expect(requester.options).toEqual({
                    retryOptions: RetryStrategy.NO_RETRIES,
                    timeout: 1,
                })
            })
        })

        describe('when a request attempt has completed', () => {
            let fetch: Spy<Fetch>
            let requester: RequesterImpl
            beforeEach(() => {
                fetch = createSpy('fetch').and.returnValue(
                    Promise.resolve(mockOkResponse)
                )
                requester = new RequesterImpl({
                    networkMetricsController,
                    fetch,
                })
            })

            it('adds a metrics entry on fetchProvider.fetchEventComplete', async () => {
                await requester.request('')
                expect(
                    networkMetricsController.addMetricsEntry
                ).toHaveBeenCalledOnceWith({
                    ok: true,
                    serviceId: null,
                    retryAfter: null,
                    responseTime: 0,
                })

                networkMetricsController.addMetricsEntry.calls.reset()
                await requester.request('', {}, { serviceId: 'serviceId1' })
                expect(
                    networkMetricsController.addMetricsEntry
                ).toHaveBeenCalledOnceWith({
                    ok: true,
                    serviceId: 'serviceId1',
                    retryAfter: null,
                    responseTime: 0,
                })
            })

            describe('when fetchEventComplete represents an abort rejection', () => {
                it('does not add a metrics entry', async () => {
                    const abort = new Abort()
                    abort.abort(new Error('reason'))
                    await requester
                        .request('example', {}, { abort })
                        .catch(noop)
                    expect(
                        networkMetricsController.addMetricsEntry
                    ).not.toHaveBeenCalled()
                })
            })

            describe('when the failure is a network error', () => {
                it('does not add a metrics entry', async () => {
                    fetch.and.rejectWith(new Error('network failure'))
                    await requester.request('').catch(noop)
                    expect(
                        networkMetricsController.addMetricsEntry
                    ).not.toHaveBeenCalled()
                })
            })

            it('provides retry-after', async () => {
                clock.mockDate(new Date(456))
                mock503Response = new Response('', {
                    status: 503,
                    headers: {
                        'retry-after': '123',
                    },
                })
                fetch.and.returnValue(Promise.resolve(mock503Response))
                await requester.request('').catch(noop)
                expect(
                    networkMetricsController.addMetricsEntry
                ).toHaveBeenCalledOnceWith(
                    objectContaining({
                        retryAfter: 456 + 123_000,
                    })
                )
            })
        })
    })
})

describe('request', () => {
    let mockRequester: MockRequester
    beforeEach(() => {
        mockRequester = new MockRequester()
        requesterWithRetryRef.set(() => mockRequester)
    })

    it('delegates to the global fetchProvider dependency', async () => {
        const mockResponse = new Response()
        mockRequester.request.and.returnValue(Promise.resolve(mockResponse))
        const r = await requestWithRetry(
            'a',
            { method: 'POST' },
            { serviceId: 'serviceId' }
        )
        expect(r).toBe(mockResponse)
        expect(mockRequester.request).toHaveBeenCalledOnceWith(
            'a',
            { method: 'POST' },
            { serviceId: 'serviceId' }
        )
    })
})

describe('nativeFetch', () => {
    describe('when fetch is defined', () => {
        beforeEach(() => {
            if (isNode()) {
                const g = global as any
                g.window = {
                    fetch: createSpy(),
                }
                setMockNavigator()
            }
        })

        afterEach(() => {
            if (isNode()) {
                delete (global as any).window
            }
        })
        it('returns window.fetch', () => {
            expect(nativeFetchRef.value).toEqual(any(Function))
        })
    })

    describe('when fetch is not defined', () => {
        const originalFetch = global.fetch
        beforeEach(() => {
            if (!isNode()) {
                pending('requires node')
                return
            }
            delete (global as any).fetch
        })

        afterEach(() => {
            global.fetch = originalFetch
        })

        it('returns a stub that throws an error', () => {
            expect(() => nativeFetchRef.value('')).toThrowError(
                'global fetch not found'
            )
        })
    })
})
