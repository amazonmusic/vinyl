/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Spy = jasmine.Spy

/**
 * A type representing any type of function.
 */
type Fun = (...args: any[]) => any

/**
 * Creates or returns a Spy for a function on an object.
 * If the method is already a spy, it will be returned.
 * If not, a spy will be created.
 *
 * @param object
 * @param method
 */
export function asSpy<T, K extends keyof T = keyof T>(
    object: T,
    method: T[K] extends Fun ? K : never
): Spy<
    T[K] extends jasmine.Func
        ? T[K]
        : T[K] extends { new (...args: infer A): infer V }
          ? (...args: A) => V
          : never
> {
    if (object == null || object[method] == null) {
        throw new Error('method not implemented')
    }
    const fun = object[method] as Fun
    if ('calls' in fun) {
        return fun as Spy
    } else {
        return spyOn(object, method as any)
    }
}
