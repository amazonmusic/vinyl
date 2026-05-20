/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    requestWithRetry,
    RequesterImpl,
    requesterWithRetryRef,
} from '@amazon/vinyl-util'
import { MockRequester, overrideGlobalInit } from '@amazon/vinyl-util/testUtil'

describe('requesterWithRetryRef', () => {
    it('creates a requester impl', () => {
        expect(requesterWithRetryRef.value).toBeInstanceOf(RequesterImpl)
    })
})

describe('requestWithRetry', () => {
    const mockRequester = overrideGlobalInit(
        requesterWithRetryRef,
        () => new MockRequester()
    )

    it('uses the requesterWithRetryRef', async () => {
        await requestWithRetry('https://example.com')
        expect(mockRequester.value.request).toHaveBeenCalledOnceWith(
            'https://example.com',
            undefined,
            undefined
        )
    })
})
