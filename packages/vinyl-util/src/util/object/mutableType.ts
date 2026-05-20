/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Fun } from '@/util/type'
import type { ReadonlyDate, ReadonlyMap, ReadonlySet } from './readonlyType'

/**
 * Recursively removes read only modifiers.
 * Special core types such as read only Dates, Maps, and Sets will be converted to their writable
 * variants.
 */
export type MutableDeep<T> = T extends readonly any[]
    ? MutableTupleOrArrayDeep<T>
    : T extends Fun | Blob
      ? T
      : T extends ReadonlyDate
        ? Date
        : T extends ReadonlyMap<infer K, infer V>
          ? MutableMapDeep<K, V>
          : T extends ReadonlySet<infer V>
            ? MutableSetDeep<V>
            : T extends object
              ? MutableObjectDeep<T>
              : T

/**
 * Recursively marks a tuple (up to 4 in length) or an array as read only.
 */
export type MutableTupleOrArrayDeep<T extends readonly any[]> =
    T extends readonly [infer V0]
        ? // Support tuples up to 4 in length
          [MutableDeep<V0>]
        : T extends readonly [infer V0, infer V1]
          ? [MutableDeep<V0>, MutableDeep<V1>]
          : T extends readonly [infer V0, infer V1, infer V2]
            ? [MutableDeep<V0>, MutableDeep<V1>, MutableDeep<V2>]
            : T extends readonly [infer V0, infer V1, infer V2, infer V3]
              ? [
                    MutableDeep<V0>,
                    MutableDeep<V1>,
                    MutableDeep<V2>,
                    MutableDeep<V3>,
                ]
              : T extends readonly [
                      infer V0,
                      infer V1,
                      infer V2,
                      infer V3,
                      infer V4,
                  ]
                ? [
                      MutableDeep<V0>,
                      MutableDeep<V1>,
                      MutableDeep<V2>,
                      MutableDeep<V3>,
                      MutableDeep<V4>,
                  ]
                : // Unknown or greater than 5 explicit elements
                  MutableArrayDeep<T[number]>

/**
 * A recursively deep mutable array. Do not use this directly, use {@link MutableDeep} instead,
 * which works for dates, maps, sets, etc.
 */
export type MutableArrayDeep<T> = MutableDeep<T>[]

/**
 * A recursively deep mutable object. Do not use this directly, use {@link MutableDeep} instead,
 * which works for dates, maps, sets, etc.
 */
export type MutableObjectDeep<T> = {
    -readonly [P in keyof T]: MutableDeep<T[P]>
}

/**
 * A map with mutable values.
 */
export type MutableMapDeep<K, V> = Map<K, MutableDeep<V>>

/**
 * A Set type with mutable values.
 */
export type MutableSetDeep<V> = Set<MutableDeep<V>>

/**
 * Removes read only modifiers from Objects, Arrays, Maps, Sets, or Dates.
 * Other non-primitive types will retain their method signatures.
 */
export type Mutable<T> = T extends readonly any[]
    ? [...T]
    : T extends Fun | Blob
      ? T
      : T extends ReadonlyDate
        ? Date
        : T extends ReadonlyMap<infer K, infer V>
          ? Map<K, V>
          : T extends ReadonlySet<infer V>
            ? Set<V>
            : T extends object
              ? MutableObject<T>
              : T

/**
 * A mutable object. Do not use this directly, use {@link Mutable} instead,
 * which works for dates, maps, sets, etc.
 */
export type MutableObject<T> = {
    -readonly [P in keyof T]: T[P]
}
