/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isPlainObject } from '@/util/object/object'
import type { AnyRecord, Fun, IsAny } from '@/util/type'

/**
 * A representation of the conversion the toJson function will apply to make an input JSON compatible.
 */
export type Json<T = any> =
    IsAny<T> extends true
        ? // inputs of type `any` are allowed, use AnyRecord as the mapped type to pass JsonCompatible<T> validation.
          AnyRecord
        : unknown extends T
          ? never
          : T extends bigint | symbol | Fun
            ? string
            : T extends { toJSON(): infer R }
              ? R
              : T extends boolean | number | string | null | undefined
                ? T
                : T extends Set<infer U>
                  ? Json<U>[]
                  : T extends readonly any[]
                    ? Json<T[number]>[]
                    : {
                          [P in keyof T]: Json<T[P]>
                      }

/**
 * Converts a dynamic value to a serializable value.
 * The value must be either an object with a toJSON function, a primitive, or a plain object
 * where all enumerable properties map to values supported by this function.
 * Properties not enumerable will be omitted, properties not serializable will be converted
 * to strings.
 * - bigint -> value.toString
 * - function -> [function <name>]
 * - symbol -> [symbol <name>]
 *
 * Error instances have a special case where non-serializable errors will still have their
 * name, message, and stack properties serialized.
 *
 * Note that this is not intended for use in serializing objects where all values are known;
 * it's intended to cover the case of reporting or logging an unknown object that may or may not
 * be serializable.
 *
 * @param value
 */
export function toJson<T>(value: T): Json<T> {
    return toJsonInternal(value, new Set())
}

function toJsonInternal(value: any, visited: Set<any>): any {
    switch (typeof value) {
        case 'object':
            return objectToJsonInternal(value, visited)
        case 'undefined':
        case 'boolean':
        case 'number':
        case 'string':
            return value
        case 'function':
            return `[function ${value.name}]`
        case 'symbol':
            return `[symbol ${value.toString().slice(7, -1)}]`
        case 'bigint':
            return value.toString()
    }
}

function objectToJsonInternal(value: any, visited: Set<any>): any {
    if (value == null) return value
    if (visited.has(value)) return `<circular reference: ${String(value)}>`
    visited.add(value)
    if ('toJSON' in value && typeof value.toJSON === 'function')
        return value.toJSON()
    if (value instanceof Set) {
        return Array.from(value).map((e) => toJsonInternal(e, visited))
    } else if (Array.isArray(value)) {
        return value.map((e) => toJsonInternal(e, visited))
    } else {
        if (isPlainObject(value)) {
            const o: Record<any, any> = {}
            for (const key in value) {
                o[key] = toJsonInternal(value[key], visited)
            }
            return o
        } else if (value instanceof Error) {
            // non-enumerable properties
            return {
                name: value.name,
                message: value.message,
                stack: value.stack,
            }
        } else {
            return value.toString()
        }
    }
}
