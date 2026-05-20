/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Expects that two iterable objects have the same elements.
 *
 * @param arr1
 * @param arr2
 */
export function expectIterableEquals<T>(
    arr1: Iterable<T> | ArrayLike<T>,
    arr2: Iterable<T> | ArrayLike<T>
) {
    expect(Array.from(arr1)).toEqual(Array.from(arr2))
}
