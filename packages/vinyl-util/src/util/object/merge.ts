/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An intersection of T & U where common keys of T and U are overwritten by U.
 */
export type Merge<T, U> = Omit<T, keyof U> & U

/**
 * Copy the values of all the enumerable own properties from one or more source objects to a new
 * object.
 *
 * This will use `Object.assign` using a new object as the target parameter.
 * Unlike `Object.assign`, the return type accounts for common keys.
 *
 * @param source1 The first source object from which to copy properties.
 * @return Returns the new merged object.
 */
export function merge<T>(source1: T): T

/**
 * Concatenates arrays.
 *
 * @return Returns a new concatenated array.
 */
export function merge<T>(...sources: T[][]): T[]

/**
 * Copy the values of all the enumerable own properties from one or more source objects to a new
 * object.
 *
 * This will use `Object.assign` using a new object as the target parameter.
 * Unlike `Object.assign`, the return type accounts for common keys.
 *
 * @param source1 The first source object from which to copy properties.
 * @param source2 The second source object from which to copy properties.
 * @return Returns the new merged object.
 */
export function merge<T, U>(source1: T, source2: U): Merge<T, U>

/**
 * Copy the values of all the enumerable own properties from one or more source objects to a new
 * object.
 *
 * This will use `Object.assign` using a new object as the target parameter.
 * Unlike `Object.assign`, the return type accounts for common keys.
 *
 * @param source1 The first source object from which to copy properties.
 * @param source2 The second source object from which to copy properties.
 * @param source3 The third source object from which to copy properties.
 * @return Returns the new merged object.
 */
export function merge<T, U, V>(
    source1: T,
    source2: U,
    source3: V
): Merge<Merge<T, U>, V>

/**
 * Copy the values of all the enumerable own properties from one or more source objects to a new
 * object.
 *
 * This will use `Object.assign` using a new object as the target parameter.
 * Unlike `Object.assign`, the return type accounts for common keys.
 *
 * @param source1 The first source object from which to copy properties.
 * @param source2 The second source object from which to copy properties.
 * @param source3 The third source object from which to copy properties.
 * @param source4 The third source object from which to copy properties.
 * @return Returns the new merged object.
 */
export function merge<T, U, V, W>(
    source1: T,
    source2: U,
    source3: V,
    source4: W
): Merge<Merge<Merge<T, U>, V>, W>

/**
 * Copy the values of all the enumerable own properties from one or more source objects to a new
 * object.
 *
 * This will use `Object.assign` using a new object as the target parameter.
 * Unlike `Object.assign`, the return type accounts for common keys.
 *
 * @param sources
 * @return Returns the new merged object.
 */
export function merge(...sources: any[]): any

/**
 * Copy the values of all the enumerable own properties from one or more source objects to a
 * new object.
 *
 * This will use `Object.assign` using a new object as the target parameter.
 *
 * @param sources One or more source objects from which to copy properties
 */
export function merge(...sources: any[]): any {
    if (!sources.length) return undefined
    if (Array.isArray(sources[0])) return Array.prototype.concat(...sources)
    return Object.assign({}, ...sources)
}
