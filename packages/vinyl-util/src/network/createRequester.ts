/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { networkLoggingHandler } from './logging/networkLoggingHandler'
import { networkMetricsController } from './metrics/networkMetricsGlobal'
import type { Requester } from './Requester'
import type { RequesterImplDeps, RequesterImplOptions } from './RequesterImpl'
import { nativeFetchRef, RequesterImpl } from './RequesterImpl'
import { merge } from '../util/object/merge'
import type { Maybe, PartialDeep } from '../util/type'

/**
 * Creates a default Requester implementation with optional configuration or dependency overrides.
 * The new Requester is watched for global logging and network metrics.
 *
 * @param options
 * @param deps
 */
export function createRequester(
    options?: Maybe<PartialDeep<RequesterImplOptions>>,
    deps?: Partial<RequesterImplDeps>
): Requester {
    const defaultDeps = {
        networkMetricsController: networkMetricsController.value,
        fetch: nativeFetchRef.value,
    } as const satisfies RequesterImplDeps
    const finalDeps = merge(defaultDeps, deps)
    const requester = new RequesterImpl(finalDeps)
    if (options) requester.configure(options)
    // The logging handler does not need to be disposed, when the requester is disposed
    // the handlers will no longer be referenced.
    networkLoggingHandler(requester)
    return requester
}
