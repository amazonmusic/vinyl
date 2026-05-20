/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provides the logging prefix for all logs made by this target.
 */
export interface LogTarget {
    /**
     * A string prefix for all log statements made by this target.
     */
    readonly logPrefix: string
}

/**
 * A static counter for creating a locally-unique id.
 */
let counter = 0

/**
 * Creates a unique log prefix.
 *
 * @param target Either a string or an object with a toStringTag.
 * The log prefix will append a unique counter.
 */
export function createLogPrefix(
    target: string | { readonly [Symbol.toStringTag]: string }
): string {
    const name =
        typeof target === 'string' ? target : target[Symbol.toStringTag]
    return `${name}/${++counter}`
}
