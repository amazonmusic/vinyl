/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorLevel,
    ErrorOrigin,
    isReportableError,
    isResponseError,
    isSilentError,
    readResponseBody,
    RequestError,
} from '@amazon/vinyl-util'
import {
    emptyNetworkError,
    emptyResponseError,
} from '@amazon/vinyl-util/testUtil'

describe('isResponseError', () => {
    it('returns true if the provided object is a RequestError with type RESPONSE', () => {
        expect(
            isResponseError(new RequestError(null, emptyResponseError))
        ).toBeTrue()
        expect(
            isResponseError(new RequestError(null, emptyNetworkError))
        ).toBeFalse()
        expect(isResponseError(new Error())).toBeFalse()
    })
})

describe('readResponseBody', () => {
    // A minimal stand-in for a Response whose body read resolves or rejects.
    function fakeResponse(
        status: number,
        body: {
            arrayBuffer?: () => Promise<ArrayBuffer>
            text?: () => Promise<string>
            json?: () => Promise<any>
        }
    ): Response {
        return { status, ...body } as unknown as Response
    }

    it('returns the parsed body on success', async () => {
        const buffer = new ArrayBuffer(8)
        await expectAsync(
            readResponseBody(
                fakeResponse(200, {
                    arrayBuffer: () => Promise.resolve(buffer),
                }),
                'arrayBuffer'
            )
        ).toBeResolvedTo(buffer)
        await expectAsync(
            readResponseBody(
                fakeResponse(200, { text: () => Promise.resolve('hi') }),
                'text'
            )
        ).toBeResolvedTo('hi')
        await expectAsync(
            readResponseBody(
                fakeResponse(200, { json: () => Promise.resolve({ a: 1 }) }),
                'json'
            )
        ).toBeResolvedTo({ a: 1 })
    })

    it('classifies a mid-body network failure as a serviceInternal error', async () => {
        const response = fakeResponse(200, {
            arrayBuffer: () => Promise.reject(new TypeError('Failed to fetch')),
        })
        try {
            await readResponseBody(response, 'arrayBuffer')
            fail('expected a rejection')
        } catch (error) {
            expect(isReportableError(error)).toBeTrue()
            expect((error as any).origin).toBe(ErrorOrigin.SERVICE_INTERNAL)
            expect((error as any).level).toBe(ErrorLevel.FATAL)
            expect(isSilentError(error)).toBeFalse()
        }
    })

    it('classifies a body read failure on a 5xx response as serviceExternal', async () => {
        const response = fakeResponse(503, {
            text: () => Promise.reject(new TypeError('Failed to fetch')),
        })
        try {
            await readResponseBody(response, 'text')
            fail('expected a rejection')
        } catch (error) {
            expect((error as any).origin).toBe(ErrorOrigin.SERVICE_EXTERNAL)
        }
    })

    it('preserves an aborted read as a silent error', async () => {
        const abortError = new Error('aborted')
        abortError.name = 'AbortError'
        const response = fakeResponse(200, {
            text: () => Promise.reject(abortError),
        })
        try {
            await readResponseBody(response, 'text')
            fail('expected a rejection')
        } catch (error) {
            expect(isSilentError(error)).toBeTrue()
            expect((error as any).level).toBe(ErrorLevel.SILENT)
        }
    })
})
