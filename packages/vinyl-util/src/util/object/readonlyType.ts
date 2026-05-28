/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Fun } from '../type'

/**
 * Recursively marks Objects, Arrays, Maps, Sets, or Dates as read only.
 * Other non-primitive types will retain their method signatures, potentially exposing mutation
 * methods.
 * This type does not represent an immutable value, merely a readonly variant of T.
 */
export type ReadonlyDeep<T> =
    T extends Array<any>
        ? ReadonlyTupleOrArrayDeep<T>
        : T extends Fun
          ? T
          : T extends Date
            ? ReadonlyDate
            : T extends Map<infer K, infer V>
              ? ReadonlyMapDeep<K, V>
              : T extends Set<infer V>
                ? ReadonlySetDeep<ReadonlyDeep<V>>
                : T extends object
                  ? ReadonlyObjectDeep<T>
                  : T

/**
 * Recursively marks a tuple (up to 5 in length) or an array as read only.
 */
export type ReadonlyTupleOrArrayDeep<T extends any[]> = T extends [infer V0]
    ? // Support tuples up to 5 in length
      readonly [ReadonlyDeep<V0>]
    : T extends [infer V0, infer V1]
      ? readonly [ReadonlyDeep<V0>, ReadonlyDeep<V1>]
      : T extends [infer V0, infer V1, infer V2]
        ? readonly [ReadonlyDeep<V0>, ReadonlyDeep<V1>, ReadonlyDeep<V2>]
        : T extends [infer V0, infer V1, infer V2, infer V3]
          ? readonly [
                ReadonlyDeep<V0>,
                ReadonlyDeep<V1>,
                ReadonlyDeep<V2>,
                ReadonlyDeep<V3>,
            ]
          : T extends [infer V0, infer V1, infer V2, infer V3, infer V4]
            ? readonly [
                  ReadonlyDeep<V0>,
                  ReadonlyDeep<V1>,
                  ReadonlyDeep<V2>,
                  ReadonlyDeep<V3>,
                  ReadonlyDeep<V4>,
              ]
            : // Unknown length or greater than 5 explicit elements
              ReadonlyArrayDeep<T[number]>

/**
 * A recursively deep read only array. Do not use this directly, use {@link ReadonlyDeep} instead,
 * which works for Objects and Arrays.
 */
export type ReadonlyArrayDeep<E> = readonly ReadonlyDeep<E>[]

/**
 * A recursively deep read only object. Do not use this directly, use {@link ReadonlyDeep} instead,
 * which works for Objects and Arrays.
 */
export type ReadonlyObjectDeep<T> = {
    readonly [P in keyof T]: ReadonlyDeep<T[P]>
}

/**
 * A shallow, readonly Record.
 * Note, this differs from Record only by readonly modifiers, as such there is no compile time
 * safety preventing a ReadonlyRecord from being assigned to a Record type.
 */
export type ReadonlyRecord<K extends keyof any, T> = {
    readonly [P in K]: T
}

/**
 * A Date type with mutation functions omitted.
 */
export type ReadonlyDate = Readonly<
    Omit<
        Date,
        | 'setDate'
        | 'setFullYear'
        | 'setHours'
        | 'setMilliseconds'
        | 'setMinutes'
        | 'setMonth'
        | 'setSeconds'
        | 'setTime'
        | 'setUTCDate'
        | 'setUTCFullYear'
        | 'setUTCHours'
        | 'setUTCMilliseconds'
        | 'setUTCMinutes'
        | 'setUTCMonth'
        | 'setUTCSeconds'
    >
>

/**
 * A Map type with mutation functions omitted.
 */
export type ReadonlyMap<K, out V> = Readonly<
    Omit<Map<K, V>, 'clear' | 'delete' | 'set'>
>

/**
 * A deep, readonly map.
 */
export type ReadonlyMapDeep<K, out V> = ReadonlyMap<K, ReadonlyDeep<V>>

/**
 * A Set type with mutation functions omitted.
 */
export type ReadonlySet<out E> = Readonly<
    Omit<Set<E>, 'add' | 'clear' | 'delete'>
>

/**
 * A deep, readonly set.
 */
export type ReadonlySetDeep<out E> = ReadonlySet<ReadonlyDeep<E>>

/**
 * A type alias to ReadonlyDeep that has the additional connotation that the value is constant.
 *
 * An immutable object may or may not be frozen, but write access should always consider to be
 * forbidden.
 */
export type Immutable<T> = ReadonlyDeep<T>
