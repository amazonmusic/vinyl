/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An interface that may be implemented to provide custom clone behavior.
 */
export interface Cloneable<T> {
    /**
     * Produces a copy of this object.
     */
    clone(): T
}

/**
 * Returns true if the given value implements Cloneable.
 */
export function isCloneable<T>(value: T): value is T & Cloneable<T> {
    return (
        value != null &&
        typeof value === 'object' &&
        'clone' in value &&
        typeof value.clone === 'function' &&
        value.clone.length === 0
    )
}
