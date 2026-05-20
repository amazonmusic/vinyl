/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns the keys (both property names and symbols) of all own properties.
 * Unlike `Object.keys`, this will also return non-enumerable properties.
 * Does not return keys inherited from the object's prototype.
 *
 * Implementation details:
 * If Reflect is supported, Reflect.ownKeys will be used, wrapping in a Set, otherwise
 * Object.getOwnPropertyNames and Object.getOwnPropertySymbols will be used. This will typically
 * be equivalent. Proxies may alter the order of keys but platforms that do not support Reflect
 * will also typically not support Proxies.
 *
 * @see Reflect.ownKeys
 * @see Object.getOwnPropertyNames
 * @see Object.getOwnPropertySymbols
 * @param obj
 * @return Returns a `Set` of the own properties of the target object, including non-enumerable.
 * The ordering will be: positive numeric indexes in order, strings in insertion order,
 * symbols in insertion order.
 */
export function ownKeys<T>(obj: T): Set<keyof T> {
    if (!obj) return new Set()
    if (typeof Reflect !== 'undefined')
        return new Set(Reflect.ownKeys(obj) as (keyof T)[])
    const properties = new Set()
    Object.getOwnPropertyNames(obj).forEach((item) => properties.add(item))
    Object.getOwnPropertySymbols(obj).forEach((item) => properties.add(item))
    return properties as Set<keyof T>
}

/**
 * Returns the prototype chain of the given object.
 *
 * Example:
 * ```
 * class A {}
 * class B extends A {}
 * class C extends B {}
 * const c = new C()
 * getPrototypeChain(c) // [c, C.prototype, B.prototype, A.prototype, Object.prototype]
 * ```
 * @param obj
 */
export function getPrototypeChain(obj: any): any[] {
    const out = []
    let current = obj
    do {
        out.push(current)
    } while ((current = Object.getPrototypeOf(current)))
    return out
}

/**
 * Returns true if the given object represents a plain object and not a class instance.
 */
export function isPlainObject(value: any): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false
    const proto = Object.getPrototypeOf(value)
    // if not the null prototype, not a plain object:
    return !proto || !Object.getPrototypeOf(proto)
}

/**
 * Gets the object's value for the given key if it exists, otherwise sets [key] to
 * `defaultValue`, returning the newly set value.
 *
 * @param object
 * @param key
 * @param defaultValue
 */
export function getOrSetProp<K extends keyof T, T extends object>(
    object: T,
    key: K,
    defaultValue: () => T[K]
): T[K] {
    if (key in object) {
        return object[key]
    } else {
        const value = defaultValue()
        object[key] = value
        return value
    }
}

/**
 * Returns true if value is not null. Provides a type guard which can be used in filters.
 * Example:
 * [1, null, 2, 3, null, 4].filter(isNonNull) // type number[]
 * @param value
 */
export function isNonNull<T>(value: T): value is NonNullable<T> {
    return value != null
}
