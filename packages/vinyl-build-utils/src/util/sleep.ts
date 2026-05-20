/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns a promise that resolves after a set amount of time.
 * @param time The number of seconds to sleep.
 */
export function sleep(time: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, time * 1000)
    })
}
