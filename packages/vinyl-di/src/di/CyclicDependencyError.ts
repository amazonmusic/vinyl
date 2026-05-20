/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError } from '@amazon/vinyl-util'

/**
 * Thrown at runtime if a dependency is determined to depend upon itself.
 *
 * When using TypeScript this should result in a {@link NeverCyclicDependency} compile-time
 * validation error when using {@link validateFactories} unless there was an unsafe cast.
 */
export class CyclicDependencyError extends IllegalArgumentError {
    get [Symbol.toStringTag](): string {
        return 'CyclicDependencyError'
    }

    constructor(message: string) {
        super(message)
        Object.setPrototypeOf(this, CyclicDependencyError.prototype)
    }
}
