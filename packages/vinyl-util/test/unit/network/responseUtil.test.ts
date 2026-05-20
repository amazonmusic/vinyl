/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isResponseError, RequestError } from '@amazon/vinyl-util'
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
