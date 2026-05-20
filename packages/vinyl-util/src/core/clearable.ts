/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Clearable {
    /**
     * Clears this object.
     */
    clear(): void
}

/**
 * Returns true if the value implements Clearable.
 *
 * @param value
 */
export function isClearable(value: any): value is Clearable {
    return (
        value != null &&
        'clear' in value &&
        typeof value.clear === 'function' &&
        value.clear.length === 0
    )
}

/**
 * If the given object implements Clearable, executes clear.
 *
 * @param value
 */
export function maybeClear(value: any): void {
    if (isClearable(value)) value.clear()
}
