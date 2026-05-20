/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import createSpy = jasmine.createSpy
import Spy = jasmine.Spy
import SpyAnd = jasmine.SpyAnd
import Calls = jasmine.Calls
import MatchableArgs = jasmine.MatchableArgs

type Fun = (...args: any[]) => any

/**
 * A SpyFactory creates spies by member access. The spies will be named based on the key,
 * and the type interface of the Spy will match the corresponding interface function.
 */
export interface SpyFactory<T> {
    <K extends FunctionKeys<T>>(
        key: K
    ): T[K] extends Fun ? Spy2<NoThisType<NonNullable<T[K]>>> : never
}

/**
 *  Fixes Jasmine's Spy type.
 *  Jasmine's Spy interface has a call signature instead of intersecting the original function type.
 *  This causes parameterized types of the call signature to be dropped.
 */
export type Spy2<Fn extends Fun> = Fn & {
    and: SpyAnd<Fn>
    calls: Calls<Fn>
    withArgs(...args: MatchableArgs<Fn>): Spy<Fn>
}

export type FunctionKeys<T> = {
    [P in keyof T]: T[P] extends Fun ? P : never
}[keyof T]

/**
 * Creates a new spy factory.
 *
 * @param createFake If provided, all spies will be created with the fake implementation createFake
 * returns for the given key.
 */
export function createSpyFactory<T>(
    createFake?: (key: FunctionKeys<T>) => Fun
): SpyFactory<T> {
    return (key: FunctionKeys<T>) => {
        const spy = createSpy(String(key))
        if (createFake) spy.and.callFake(createFake(key))
        return spy as any
    }
}

/**
 * Creates a Spy.
 * This is an alias to jasmine.createSpy with fixed type parameters.
 * @param key
 */
export function createSpy2<Fn extends Fun | undefined>(
    key: keyof any
): Spy2<NoThisType<NonNullable<Fn>>> {
    return createSpy(String(key)) as any
}

/**
 * Replaces `this` type with `any` in a method signature.
 */
export type NoThisType<Fn extends Fun> =
    ReturnType<Fn> extends ThisType<any>
        ? Fn & ((...args: Parameters<Fn>) => any)
        : Fn
