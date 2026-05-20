/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns the union of two sets. That is, the unique elements of A and B.
 *
 * @param a
 * @param b
 * @return Returns a new Set `A ∪ B`
 */
export function union<T, U>(a: ReadonlySet<T>, b: ReadonlySet<U>): Set<T | U> {
    return new Set([...a, ...b])
}

/**
 * Returns the set difference of A and B. That is, the elements of A that are not in B.
 *
 * @param a
 * @param b
 * @return Returns a new Set that is `A \ B`
 */
export function diff<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
    const out: Set<T> = new Set()
    a.forEach((e) => {
        if (!b.has(e)) out.add(e)
    })
    return out
}
