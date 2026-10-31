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

    describe('toJSON credential redaction', () => {
        const tokenRefreshError = new RequestError(null, {
            ...emptyResponseError,
            requestInfo: {
                ...emptyResponseError.requestInfo,
                requestId: 'req-1',
                timestamp: 1234,
                input: 'https://api.example.com/auth/token?code=abc123&keep=1',
                init: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: 'Bearer sekrit-bearer',
                        'x-amz-access-token': 'sekrit-atz',
                        Cookie: 'session=sekrit-cookie',
                        'Set-Cookie': 'session=sekrit-cookie',
                        'x-api-key': 'sekrit-key',
                        'X-CSRF-Token': 'sekrit-csrf',
                    },
                    body: 'grant_type=refresh_token&refresh_token=sekrit-refresh&client_secret=sekrit-client',
                },
            },
            responseInfo: {
                ...emptyResponseError.responseInfo,
                status: 400,
                url: 'https://api.example.com/auth/token?access_token=sekrit-access',
            },
            reason: '{"error":"invalid_grant","refresh_token":"sekrit-refresh"}',
        })

        it('serializes a failed token refresh without any secret', () => {
            const json = JSON.stringify(tokenRefreshError.toJSON())
            expect(json).not.toMatch(/sekrit/)
        })

        it('keeps the method, url, status, request id and timing', () => {
            const { info } = tokenRefreshError.toJSON() as any
            expect(info.requestInfo.init.method).toBe('POST')
            expect(info.requestInfo.input).toBe(
                'https://api.example.com/auth/token?code=[redacted]&keep=1'
            )
            expect(info.requestInfo.requestId).toBe('req-1')
            expect(info.requestInfo.timestamp).toBe(1234)
            expect(info.responseInfo.status).toBe(400)
            expect(info.responseInfo.url).toBe(
                'https://api.example.com/auth/token?access_token=[redacted]'
            )
        })

        it('drops the request body', () => {
            const { info } = tokenRefreshError.toJSON() as any
            expect('body' in info.requestInfo.init).toBeFalse()
        })

        it('masks credential headers and keeps the others', () => {
            const { info } = tokenRefreshError.toJSON() as any
            expect(Object.fromEntries(info.requestInfo.init.headers)).toEqual({
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: '[redacted]',
                'x-amz-access-token': '[redacted]',
                Cookie: '[redacted]',
                'Set-Cookie': '[redacted]',
                'x-api-key': '[redacted]',
                'X-CSRF-Token': '[redacted]',
            })
        })

        it('masks any header, field or query value with a credential name', () => {
            const e = new RequestError(null, {
                ...emptyNetworkError,
                requestInfo: {
                    ...emptyNetworkError.requestInfo,
                    input: 'https://a.test/p?X-Amz-Security-Token=sekrit&apiKey=sekrit&keep=1',
                    init: {
                        headers: {
                            'X-Auth-Token': 'sekrit',
                            'x-goog-api-key': 'sekrit',
                            'X-XSRF-TOKEN': 'sekrit',
                            'Content-Type': 'text/plain',
                            'X-Request-Id': 'id-1',
                        },
                    },
                },
                reason: {
                    password: 'sekrit',
                    sessionToken: 'sekrit',
                    clientCredentials: 'sekrit',
                    author: 'kept',
                },
            })
            const json = e.toJSON() as any
            expect(JSON.stringify(json)).not.toContain('sekrit')
            const { info } = json
            expect(info.requestInfo.input).toBe(
                'https://a.test/p?X-Amz-Security-Token=[redacted]&apiKey=[redacted]&keep=1'
            )
            expect(Object.fromEntries(info.requestInfo.init.headers)).toEqual(
                jasmine.objectContaining({
                    'Content-Type': 'text/plain',
                    'X-Request-Id': 'id-1',
                })
            )
            expect(info.reason.author).toBe('kept')
        })

        it('masks credential headers given as Headers or pairs', () => {
            for (const headers of [
                new Headers({ Authorization: 'Bearer sekrit' }),
                [['Authorization', 'Bearer sekrit']] as [string, string][],
            ]) {
                const e = new RequestError(null, {
                    ...emptyNetworkError,
                    requestInfo: {
                        ...emptyNetworkError.requestInfo,
                        init: { headers },
                    },
                })
                expect(JSON.stringify(e.toJSON())).not.toContain('sekrit')
            }
        })

        it('masks every token query value of a URL or Request input', () => {
            for (const input of [
                new URL(
                    'https://a.test/p?refresh_token=sekrit&id_token=sekrit&code_verifier=sekrit&client_secret=sekrit#x'
                ),
                new Request('https://a.test/p?access_token=sekrit'),
            ]) {
                const e = new RequestError(null, {
                    ...emptyNetworkError,
                    requestInfo: { ...emptyNetworkError.requestInfo, input },
                })
                const json = JSON.stringify(e.toJSON())
                expect(json).not.toContain('sekrit')
                expect(json).toContain('https://a.test/p')
            }
        })

        it('masks secrets in an error reason', () => {
            const e = new RequestError(null, {
                ...emptyInternalError,
                reason: new Error('failed: Bearer sekrit-token'),
            })
            expect(JSON.stringify(e.toJSON())).not.toContain('sekrit')
        })

        it('masks secrets inside an array reason', () => {
            const e = new RequestError(null, {
                ...emptyInternalError,
                reason: ['access_token=sekrit', 7],
            })
            const { info } = e.toJSON() as any
            expect(info.reason).toEqual(['access_token=[redacted]', 7])
        })

        it('masks text values with an injected redactText', () => {
            const e = new RequestError(
                null,
                {
                    ...emptyInternalError,
                    requestInfo: {
                        ...emptyInternalError.requestInfo,
                        input: 'https://a.test/p?custom=sekrit',
                    },
                    reason: 'custom=sekrit',
                },
                (text) => text.replace('sekrit', 'masked')
            )
            const { info } = e.toJSON() as any
            expect(info.requestInfo.input).toBe(
                'https://a.test/p?custom=masked'
            )
            expect(info.reason).toBe('custom=masked')
        })

        it('masks secret fields of an object reason', () => {
            const e = new RequestError(null, {
                ...emptyInternalError,
                reason: { refresh_token: 'sekrit', error: 'invalid_grant' },
            })
            const { info } = e.toJSON() as any
            expect(info.reason).toEqual({
                refresh_token: '[redacted]',
                error: 'invalid_grant',
            })
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
