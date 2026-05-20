/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MaybePromise } from '../type'

/**
 * Creates a function that is the composition of the provided functions.
 * Each function consumes the return value of the function that follows.
 */
export function flow<A, B>(f1: (a: A) => B): (a: A) => B
export function flow<A, B, C>(f1: (a: A) => B, f2: (b: B) => C): (a: A) => C
export function flow<A, B, C, D>(
    f1: (a: A) => B,
    f2: (b: B) => C,
    f3: (c: C) => D
): (a: A) => D
export function flow<A, B, C, D, E>(
    f1: (a: A) => B,
    f2: (b: B) => C,
    f3: (c: C) => D,
    f4: (d: D) => E
): (a: A) => E
export function flow<A, B, C, D, E, F>(
    f1: (a: A) => B,
    f2: (b: B) => C,
    f3: (c: C) => D,
    f4: (d: D) => E,
    f5: (e: E) => F
): (a: A) => F
export function flow(...fns: Array<(arg: any) => any>): (arg: any) => any {
    return (arg: any) => fns.reduce((acc, fn) => fn(acc), arg)
}

/**
 * Creates a function that is the composition of the provided functions.
 * Each function consumes the return value of the function that precedes.
 */
export function flowRight<A, B>(f1: (a: A) => B): (a: A) => B
export function flowRight<A, B, C>(
    f1: (b: B) => C,
    f2: (a: A) => B
): (a: A) => C
export function flowRight<A, B, C, D>(
    f1: (c: C) => D,
    f2: (b: B) => C,
    f3: (a: A) => B
): (a: A) => D
export function flowRight<A, B, C, D, E>(
    f1: (d: D) => E,
    f2: (c: C) => D,
    f3: (b: B) => C,
    f4: (a: A) => B
): (a: A) => E
export function flowRight<A, B, C, D, E, F>(
    f1: (e: E) => F,
    f2: (d: D) => E,
    f3: (c: C) => D,
    f4: (b: B) => C,
    f5: (a: A) => B
): (a: A) => F
export function flowRight(...fns: Array<(arg: any) => any>): (arg: any) => any {
    return (arg: any) => fns.reduceRight((acc, fn) => fn(acc), arg)
}

/**
 * Creates a function that is the composition of the provided async functions.
 * Each function consumes the return value of the function that follows.
 */
export function flowAsync<A, B>(
    f1: (a: A) => MaybePromise<B>
): (a: A) => Promise<B>
export function flowAsync<A, B, C>(
    f1: (a: A) => MaybePromise<B>,
    f2: (b: B) => MaybePromise<C>
): (a: A) => Promise<C>
export function flowAsync<A, B, C, D>(
    f1: (a: A) => MaybePromise<B>,
    f2: (b: B) => MaybePromise<C>,
    f3: (c: C) => MaybePromise<D>
): (a: A) => Promise<D>
export function flowAsync<A, B, C, D, E>(
    f1: (a: A) => MaybePromise<B>,
    f2: (b: B) => MaybePromise<C>,
    f3: (c: C) => MaybePromise<D>,
    f4: (d: D) => MaybePromise<E>
): (a: A) => Promise<E>
export function flowAsync<A, B, C, D, E, F>(
    f1: (a: A) => MaybePromise<B>,
    f2: (b: B) => MaybePromise<C>,
    f3: (c: C) => MaybePromise<D>,
    f4: (d: D) => MaybePromise<E>,
    f5: (e: E) => MaybePromise<F>
): (a: A) => Promise<F>
export function flowAsync(
    ...fns: Array<(arg: any) => MaybePromise<any>>
): (arg: any) => Promise<any> {
    return async (arg: any) => {
        let result = arg
        for (const fn of fns) {
            result = await fn(result)
        }
        return result
    }
}

/**
 * Creates a function that is the composition of the provided async functions.
 * Each function consumes the return value of the function that precedes.
 */
export function flowRightAsync<A, B>(
    f1: (a: A) => MaybePromise<B>
): (a: A) => Promise<B>
export function flowRightAsync<A, B, C>(
    f1: (b: B) => MaybePromise<C>,
    f2: (a: A) => MaybePromise<B>
): (a: A) => Promise<C>
export function flowRightAsync<A, B, C, D>(
    f1: (c: C) => MaybePromise<D>,
    f2: (b: B) => MaybePromise<C>,
    f3: (a: A) => MaybePromise<B>
): (a: A) => Promise<D>
export function flowRightAsync<A, B, C, D, E>(
    f1: (d: D) => MaybePromise<E>,
    f2: (c: C) => MaybePromise<D>,
    f3: (b: B) => MaybePromise<C>,
    f4: (a: A) => MaybePromise<B>
): (a: A) => Promise<E>
export function flowRightAsync<A, B, C, D, E, F>(
    f1: (e: E) => MaybePromise<F>,
    f2: (d: D) => MaybePromise<E>,
    f3: (c: C) => MaybePromise<D>,
    f4: (b: B) => MaybePromise<C>,
    f5: (a: A) => MaybePromise<B>
): (a: A) => Promise<F>
export function flowRightAsync(
    ...fns: Array<(arg: any) => MaybePromise<any>>
): (arg: any) => Promise<any> {
    return async (arg: any) => {
        let result = arg
        for (let i = fns.length - 1; i >= 0; i--) {
            result = await fns[i](result)
        }
        return result
    }
}
