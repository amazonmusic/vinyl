/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { defaultLicenseProvider, DrmKeySystem } from '@amazon/vinyl'
import type { RequestInitOptions, RequestOptions } from '@amazon/vinyl-util'
import {
    Abort,
    type Requester,
    requesterWithRetryRef,
    ValidationError,
} from '@amazon/vinyl-util'
import { MockRequester, overrideGlobalInit } from '@amazon/vinyl-util/testUtil'
import Spy = jasmine.Spy
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('defaultLicenseProvider', () => {
    describe('when serverOptions url is undefined', () => {
        it('rejects with a ValidationError', async () => {
            await expectAsync(
                defaultLicenseProvider(
                    DrmKeySystem.WIDEVINE,
                    {},
                    new ArrayBuffer(0)
                )
            ).toBeRejectedWithError(
                ValidationError,
                'Missing licenseServer url in DRM configuration for keySystem: com.widevine.alpha'
            )
        })
    })

    describe('when provided a license server url', () => {
        const requesterOverride = overrideGlobalInit(
            requesterWithRetryRef,
            () => new MockRequester()
        )

        let requestSpy: Spy<Requester['request']>
        beforeEach(() => {
            requestSpy = requesterOverride.value.request
        })

        it('performs a request with the url, init options, and challenge', async () => {
            const arrayBuffer = new ArrayBuffer(0)
            const mockResponse = new Response(arrayBuffer)
            requestSpy.and.returnValue(Promise.resolve(mockResponse))
            const challenge = new ArrayBuffer(0)
            await expectAsync(
                defaultLicenseProvider(
                    DrmKeySystem.WIDEVINE,
                    {
                        url: 'https://example.com',
                        init: { headers: { foo: 'bar' } },
                    },
                    challenge,
                    new Abort()
                )
            ).toBeResolvedTo(arrayBuffer)

            expect(requestSpy).toHaveBeenCalledOnceWith(
                'https://example.com',
                objectContaining<RequestInitOptions>({
                    headers: {
                        foo: 'bar',
                    },
                    body: challenge,
                    method: 'POST',
                }),
                objectContaining<RequestOptions>({
                    abort: any(Abort),
                })
            )
        })
    })
})
