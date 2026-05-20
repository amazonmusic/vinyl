/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChangeEvent<T> {
    readonly previous: T | null
    readonly current: T
}

/**
 * Creates a function, which when invoked, will call `inner` with a new ChangeEvent.
 *
 * @param getter
 * @param inner
 */
export function createChangeEventTrigger<T>(
    getter: () => T,
    inner: (event: ChangeEvent<T>) => void
): () => void {
    let current = getter()
    return () => {
        const event: ChangeEvent<T> = {
            previous: current,
            current: getter(),
        }
        current = event.current
        inner(event)
    }
}
