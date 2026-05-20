/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A wrapper to jasmine spyOnProperty for property getters that will define property
 * if it doesn't exist.
 */
export function spyOnPropertySafe<
    T extends object,
    K extends keyof T = keyof T,
>(object: T, property: K): jasmine.Spy<(this: T) => T[K]> {
    if (!(property in object)) {
        // Object does not have property attempting to be mocked
        // define it (with an undefined value) to allow spyOnProperty to succeed.
        Object.defineProperty(object, property, {
            configurable: true,
            enumerable: true,
            get: () => undefined,
        })
    }
    return spyOnProperty(object, property, 'get')
}
