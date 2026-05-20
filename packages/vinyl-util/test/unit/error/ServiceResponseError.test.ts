/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorLevel,
    ErrorOrigin,
    ReportableError,
    SERVICE_RESPONSE_ERROR_MESSAGE,
    ServiceResponseError,
    throwServiceResponse,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any

describe('ServiceResponseError', () => {
    it('is an instance of Error and ServiceResponseError', () => {
        expectPrototype(
            () => new ServiceResponseError('message'),
            ServiceResponseError,
            ReportableError,
            Error
        )
    })

    describe('when no reason is provided', () => {
        it('uses a default message', () => {
            expect(new ServiceResponseError(null).message).toEqual(
                SERVICE_RESPONSE_ERROR_MESSAGE
            )
        })
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new ServiceResponseError('')[Symbol.toStringTag]).toBe(
                'ServiceResponseError'
            )
        })
    })

    describe('toJSON', () => {
        it('provides a serializable representation', () => {
            expect(
                new ServiceResponseError(new Error('message')).toJSON()
            ).toEqual({
                name: 'ServiceResponseError',
                message: 'message',
                level: ErrorLevel.FATAL,
                origin: ErrorOrigin.SERVICE_EXTERNAL,
                reason: {
                    name: 'Error',
                    message: 'message',
                    stack: any(String),
                },
                stack: any(String),
            })
        })
    })

    describe('ErrorOrigin', () => {
        it('is SERVICE_EXTERNAL', () => {
            expect(new ServiceResponseError('').origin).toBe(
                ErrorOrigin.SERVICE_EXTERNAL
            )
        })
    })

    describe('throwServiceResponse', () => {
        it('uses ServiceResponseError for the provided reason', () => {
            expect(() => throwServiceResponse('reason')).toThrowError(
                ServiceResponseError,
                SERVICE_RESPONSE_ERROR_MESSAGE
            )
            const reason = new Error('message')
            expect(() => throwServiceResponse(reason)).toThrowMatching((e) => {
                return (
                    e instanceof ServiceResponseError &&
                    e.reason === reason &&
                    e.message === 'message'
                )
            })
        })
        describe('when used as a catch handler', () => {
            it('wraps the caught reason with a ServiceResponseError', async () => {
                const response = new Response()
                const jsonSpy = spyOn(response, 'json')
                jsonSpy.and.rejectWith(new Error('expected json error'))
                await expectAsync(
                    response.json().catch(throwServiceResponse)
                ).toBeRejectedWithError(
                    ServiceResponseError,
                    'expected json error'
                )

                jsonSpy.and.resolveTo('good json')
                await expectAsync(
                    response.json().catch(throwServiceResponse)
                ).toBeResolvedTo('good json')
            })
        })
    })
})
