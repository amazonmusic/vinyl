/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorBodyType,
    ErrorLevel,
    ErrorOrigin,
    ReportableError,
    RequestError,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import {
    emptyAbortError,
    emptyInternalError,
    emptyNetworkError,
    emptyResponseError,
} from '@amazon/vinyl-util/testUtil'
import any = jasmine.any

describe('RequestError', () => {
    it('is an instance of RequestError and Error', () => {
        expectPrototype(
            () => new RequestError(null, emptyInternalError),
            RequestError,
            ReportableError,
            Error
        )
    })

    describe('when willRetry is true', () => {
        it('uses locale.requestFailed message', () => {
            const e = new RequestError(null, {
                ...emptyResponseError,
                willRetry: true,
                attemptInfo: {
                    currentTry: 1,
                    timestamp: 0,
                },
                requestInfo: {
                    ...emptyResponseError.requestInfo,
                    maxRetries: 2,
                },
            })
            expect(e.message).toBe('request failed, attempt 1 of 3')
        })
    })

    describe('when willRetry is false', () => {
        describe('and type is RESPONSE or NETWORK', () => {
            describe('when retries have been exhausted', () => {
                it('uses locale.requestFailedExhaustedRetries message', () => {
                    const e = new RequestError(null, {
                        ...emptyNetworkError,
                        requestInfo: {
                            ...emptyNetworkError.requestInfo,
                            maxRetries: 2,
                        },
                        attemptInfo: {
                            currentTry: 3,
                            timestamp: 0,
                        },
                    })
                    expect(e.message).toBe('request failed, exhausted 3 tries')
                })
            })
            describe('when retries have not been exhausted', () => {
                it('uses locale.requestFailedNoRetry message', () => {
                    const e = new RequestError(null, {
                        ...emptyNetworkError,
                        requestInfo: {
                            ...emptyNetworkError.requestInfo,
                            maxRetries: 2,
                        },
                        attemptInfo: {
                            currentTry: 1,
                            timestamp: 0,
                        },
                    })
                    expect(e.message).toBe('request failed, will not retry')
                })
            })
        })

        describe('and type is not RESPONSE or NETWORK', () => {
            it('uses locale.requestFailedNoRetry message', () => {
                expect(new RequestError(null, emptyInternalError).message).toBe(
                    'request failed, will not retry'
                )
                expect(
                    new RequestError(null, {
                        ...emptyInternalError,
                    }).message
                ).toBe('request failed, will not retry')
            })
        })
    })

    describe('when info.type is ABORT', () => {
        it('sets error level to SILENT', () => {
            expect(new RequestError(null, emptyInternalError).level).toBe(
                ErrorLevel.FATAL
            )
            expect(new RequestError(null, emptyAbortError).level).toBe(
                ErrorLevel.SILENT
            )
        })
    })

    describe('toJSON', () => {
        it('returns a serializable representation', () => {
            expect(new RequestError(null, emptyInternalError).toJSON()).toEqual(
                {
                    message: 'request failed, will not retry',
                    name: 'RequestError',
                    stack: any(String),
                    origin: ErrorOrigin.SERVICE_INTERNAL,
                    level: ErrorLevel.FATAL,
                    info: {
                        ok: false,
                        reason: null as any,
                        requestInfo: {
                            requestId: '',
                            requestOptions: {
                                readErrorBody: ErrorBodyType.DISABLED,
                                serviceId: null,
                            },
                            init: {},
                            input: '',
                            maxRetries: 0,
                            timestamp: 0,
                        },
                        retryAfter: null,
                        timestamp: 0,
                        type: ErrorOrigin.INTERNAL as any,
                        willRetry: false,
                    },
                }
            )
        })
    })

    describe('ErrorOrigin', () => {
        it('returns SERVICE_EXTERNAL for a 500 RequestError', () => {
            expect(
                new RequestError(null, {
                    ...emptyResponseError,
                    responseInfo: {
                        ...emptyResponseError.responseInfo,
                        status: 500,
                    },
                }).origin
            ).toBe(ErrorOrigin.SERVICE_EXTERNAL)
            expect(
                new RequestError(null, {
                    ...emptyResponseError,
                    responseInfo: {
                        ...emptyResponseError.responseInfo,
                        status: 599,
                    },
                }).origin
            ).toBe(ErrorOrigin.SERVICE_EXTERNAL)
        })
        it('returns SERVICE_INTERNAL for a 400 RequestError', () => {
            expect(
                new RequestError(null, {
                    ...emptyResponseError,
                    responseInfo: {
                        ...emptyResponseError.responseInfo,
                        status: 404,
                    },
                }).origin
            ).toBe(ErrorOrigin.SERVICE_INTERNAL)
        })
        it('returns SERVICE_INTERNAL for a network error', () => {
            expect(
                new RequestError(null, {
                    ...emptyNetworkError,
                }).origin
            ).toBe(ErrorOrigin.SERVICE_INTERNAL)
        })
    })
})
