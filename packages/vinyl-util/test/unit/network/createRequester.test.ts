/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RequesterImpl } from '@amazon/vinyl-util'
import { createRequester } from '@amazon/vinyl-util'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'
import createSpy = jasmine.createSpy

describe('createRequester', () => {
    useMockLogger()
    it('configures the RequesterImpl with the provided options, merged with defaults', () => {
        const requester = createRequester({
            timeout: 111,
        }) as RequesterImpl
        expect(requester.options.timeout).toEqual(111)
        expect(requester.options.retryOptions.retries).toEqual(0)
    })

    it('can be given overridden dependencies', async () => {
        const mockFetch = createSpy('fetch').and.resolveTo(new Response())
        const requester = createRequester(null, {
            fetch: mockFetch,
        }) as RequesterImpl
        await requester.request('')
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })
})
