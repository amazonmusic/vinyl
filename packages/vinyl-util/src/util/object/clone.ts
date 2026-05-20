/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MergeCallback, MergeRule } from './mergeDeep'
import { defaultMergeOptions, mergeDeep } from './mergeDeep'
import type { MutableDeep } from './mutableType'

/**
 * Merge options defines the behavior for {@link mergeDeep}.
 * See the {@link defaultMergeOptions} for defaults that will be used if any merge options are
 * omitted.
 */
export interface CloneOptions {
    /**
     * If an object does not pass any of the rules, if this is true the reference will be
     * copied. If false (default), a {@link MergeReferenceError} will be thrown.
     * This only applies to objects, not functions or primitives.
     */
    readonly allowReferenceCopy: boolean

    /**
     * The first clone rule that matches will be used.
     *
     * If no rules match, the value will be copied by reference unless `allowReferenceCopy` is
     * false (default), in which case, a {@link MergeReferenceError} will be thrown.
     */
    readonly rules: readonly CloneRule<any>[]
}

/**
 * A CloneRule defines if and how an object should be cloned.
 */
export interface CloneRule<T> {
    /**
     * Returns true if this MergeRule should be applied for the given object.
     * @param object
     */
    readonly matches: (object: any) => object is T

    /**
     * Clones the given value.
     *
     * @param source A value guaranteed to have matched with `matches`.
     * @param clone This callback may be used to clone sub-properties.
     */
    readonly clone: (source: T, clone: CloneCallback) => MutableDeep<T>
}

/**
 * A function to clone a sub-object from a clone rule.
 */
export type CloneCallback = <T>(
    /**
     * The source object to clone.
     */
    source: T,

    /**
     * The identifier to be used in error reporting.
     */
    prop: string | number
) => MutableDeep<T>

/**
 * Performs a deep clone on the target object.
 *
 * This is an alias for `mergeDeep(target)` that additionally converts clone rules to one-sided
 * merge rules.
 *
 * @param target The target object to clone.
 * @param options The merge options to use.
 * `clone`, unlike `mergeDeep`, `allowReferenceCopy` will default to false.
 * @see mergeDeep
 */
export function clone<T>(
    target: T,
    options?: Partial<CloneOptions>
): MutableDeep<T> {
    // mergeDeep works as a deep clone if given a single source.
    return mergeDeep<T>([target], {
        allowReferenceCopy: options?.allowReferenceCopy ?? false,
        rules: options?.rules?.map(toMergeRule) ?? defaultMergeOptions.rules,
    }) as MutableDeep<T>
}

/**
 * Creates a wrapper to convert a clone rule to a merge rule.
 */
export function toMergeRule<T>(cloneRule: CloneRule<T>): MergeRule<T> {
    return {
        matches: cloneRule.matches,
        merge(_sourceA: T | undefined, sourceB: T, merge: MergeCallback): T {
            return cloneRule.clone(
                sourceB,
                <S>(source: S, prop: string | number): MutableDeep<S> => {
                    return merge(undefined, source, prop) as MutableDeep<S>
                }
            ) as T
        },
    } as const
}
