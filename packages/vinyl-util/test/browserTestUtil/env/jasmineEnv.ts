/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

let nextTestTimeoutOverridden: boolean = false

/**
 * Sets the timeout for the current describe block.
 *
 * @param timeout The test timeout, in seconds.
 */
export function setTestTimeout(timeout: number) {
    let originalTimeout: number | null = null
    beforeEach(() => {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
        if (!nextTestTimeoutOverridden)
            jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout * 1000
    })

    afterEach(() => {
        if (originalTimeout) jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
        if (nextTestTimeoutOverridden) nextTestTimeoutOverridden = false
    })
}

/**
 * Sets the timeout for the next test and only the next test,
 * overriding any value set subsequently to setTestTimeout.
 *
 * @param timeout The test timeout, in seconds.
 */
export function setNextTestTimeout(timeout: number) {
    nextTestTimeoutOverridden = true
    jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout * 1000
}
