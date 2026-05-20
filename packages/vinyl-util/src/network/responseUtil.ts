/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RequestResponseErrorEvent } from './RequesterImplEventMap'
import { RequestFailureType } from './RequesterImplEventMap'
import { RequestError } from './RequestError'

/**
 * Returns true if the given object is a RequestError with type RESPONSE.
 * @param error
 */
export function isResponseError(error: any): error is RequestError & {
    readonly info: RequestResponseErrorEvent
} {
    return (
        error instanceof RequestError &&
        error.info.type === RequestFailureType.RESPONSE
    )
}
