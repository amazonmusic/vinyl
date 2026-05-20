/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from './ErrorOrigin'
import { ReportableError } from './ReportableError'
import { type Json, toJson } from '@/util/serialization/json'

export const SERVICE_RESPONSE_ERROR_MESSAGE = 'Unexpected service response'

export class ServiceResponseError extends ReportableError {
    constructor(readonly reason: any) {
        super(
            reason?.message ?? SERVICE_RESPONSE_ERROR_MESSAGE,
            ErrorOrigin.SERVICE_EXTERNAL
        )
        Object.setPrototypeOf(this, ServiceResponseError.prototype)
    }

    get [Symbol.toStringTag](): string {
        return 'ServiceResponseError'
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            reason: toJson(this.reason),
        }
    }
}

/**
 * When used in a catch clause of a promise, wraps the reason in a {@link ServiceResponseError}.
 */
export function throwServiceResponse(reason: any): never {
    throw new ServiceResponseError(reason)
}
