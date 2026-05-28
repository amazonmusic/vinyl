/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Fun,
    plainObjectMergeRule,
    substitute,
    ValidationError,
} from '@amazon/vinyl-util'

import {
    type AttributeRule,
    type ElementRule,
    type ElementsRule,
    type LazyXmlRule,
    type XmlRule,
    type XmlRules,
    XmlRuleType,
} from './xmlRules'

const locale = {
    illegalRuleOverrideTypeError:
        'Cannot override the rule {property} of type {sourceType} with a rule of type {overrideType}',
    illegalQNameOverrideError:
        'Cannot override the rule {property} with a different localPart or namespace',
} as const

/**
 * Recursively merges array types so that S[] & T[] becomes (S & T)[]
 * When two array elements parsing rules are merged, the result is an array with intersected
 * element types.
 */
export type Merged<T> = T extends readonly any[]
    ? MergedTupleOrArray<T>
    : T extends Fun
      ? T
      : T extends object
        ? {
              [P in keyof T]: Merged<T[P]>
          }
        : T

/**
 * `[S0, T0] & [S1, T1]` cannot be converted to `[S0 & S1, T0 & T1]`, but we can at least preserve
 * the tuple when not intersected.
 *
 * Intersected tuples become arrays. E.g. `[S0, T0] & [S1, T1]` becomes `Array<S0 | S1 | T0 | T1>`
 */
export type MergedTupleOrArray<T extends readonly any[]> = T extends [infer V0]
    ? // Support tuples up to 5 in length
      [Merged<V0>]
    : T extends [infer V0, infer V1]
      ? [Merged<V0>, Merged<V1>]
      : T extends [infer V0, infer V1, infer V2]
        ? [Merged<V0>, Merged<V1>, Merged<V2>]
        : T extends [infer V0, infer V1, infer V2, infer V3]
          ? [Merged<V0>, Merged<V1>, Merged<V2>, Merged<V3>]
          : T extends [infer V0, infer V1, infer V2, infer V3, infer V4]
            ? [Merged<V0>, Merged<V1>, Merged<V2>, Merged<V3>, Merged<V4>]
            : T extends any[]
              ? Array<Merged<T[number]>>
              : T extends readonly [infer V0]
                ? readonly [Merged<V0>]
                : T extends readonly [infer V0, infer V1]
                  ? readonly [Merged<V0>, Merged<V1>]
                  : T extends readonly [infer V0, infer V1, infer V2]
                    ? readonly [Merged<V0>, Merged<V1>, Merged<V2>]
                    : T extends readonly [
                            infer V0,
                            infer V1,
                            infer V2,
                            infer V3,
                        ]
                      ? readonly [
                            Merged<V0>,
                            Merged<V1>,
                            Merged<V2>,
                            Merged<V3>,
                        ]
                      : T extends readonly [
                              infer V0,
                              infer V1,
                              infer V2,
                              infer V3,
                              infer V4,
                          ]
                        ? readonly [
                              Merged<V0>,
                              Merged<V1>,
                              Merged<V2>,
                              Merged<V3>,
                              Merged<V4>,
                          ]
                        : ReadonlyArray<Merged<T[number]>>

/**
 * Merges the given two xml rule sets into one.
 */
export function mergeXmlRules<A extends object, B extends object>(
    a: XmlRules<A>,
    b: XmlRules<B>
): XmlRules<Merged<A & B>>

/**
 * Merges the given three xml rule sets into one.
 */
export function mergeXmlRules<
    A extends object,
    B extends object,
    C extends object,
>(a: XmlRules<A>, b: XmlRules<B>, c: XmlRules<C>): XmlRules<Merged<A & B & C>>

/**
 * Merges the given four xml rule sets into one.
 */
export function mergeXmlRules<
    A extends object,
    B extends object,
    C extends object,
    D extends object,
>(
    a: XmlRules<A>,
    b: XmlRules<B>,
    c: XmlRules<C>,
    d: XmlRules<D>
): XmlRules<Merged<A & B & C & D>>

/**
 * Merges the given five xml rule sets into one.
 */
export function mergeXmlRules<
    A extends object,
    B extends object,
    C extends object,
    D extends object,
    E extends object,
>(
    a: XmlRules<A>,
    b: XmlRules<B>,
    c: XmlRules<C>,
    d: XmlRules<D>,
    e: XmlRules<E>
): XmlRules<Merged<A & B & C & D & E>>

/**
 * Merges the given six xml rule sets into one.
 */
export function mergeXmlRules<
    A extends object,
    B extends object,
    C extends object,
    D extends object,
    E extends object,
    F extends object,
>(
    a: XmlRules<A>,
    b: XmlRules<B>,
    c: XmlRules<C>,
    d: XmlRules<D>,
    e: XmlRules<E>,
    f: XmlRules<F>
): XmlRules<Merged<A & B & C & D & E & F>>

/**
 * Merges the given rules into one ruleset.
 *
 * @param rules
 * @return A new XmlRules map with the merged rules.
 */
export function mergeXmlRules(
    ...rules: XmlRules<any>[]
): XmlRules<Merged<any>> {
    let finalRule = rules[0]
    for (let i = 1; i < rules.length; i++) {
        finalRule = plainObjectMergeRule.merge(
            finalRule,
            rules[i],
            mergeXmlRule
        ) as XmlRules<any>
    }
    return finalRule
}

function mergeXmlRule(
    sourceA: XmlRule<any> | undefined,
    sourceB: XmlRule<any>,
    prop: string | number
): XmlRule<any>

function mergeXmlRule(
    sourceA: XmlRule<any> | LazyXmlRule<any> | undefined,
    sourceB: XmlRule<any> | LazyXmlRule<any>,
    prop: string | number
): XmlRule<any> | LazyXmlRule<any>

function mergeXmlRule(
    sourceA: XmlRule<any> | LazyXmlRule<any> | undefined,
    sourceB: XmlRule<any> | LazyXmlRule<any>,
    prop: string | number
): XmlRule<any> | LazyXmlRule<any> {
    if (sourceA == null) return sourceB
    const sourceAIsLazy = typeof sourceA === 'function'
    const sourceBIsLazy = typeof sourceB === 'function'
    if (sourceAIsLazy || sourceBIsLazy) {
        return () => {
            const a = sourceAIsLazy ? sourceA() : sourceA
            const b = sourceBIsLazy ? sourceB() : sourceB
            return mergeXmlRule(a, b, prop)
        }
    }
    if (sourceA.type !== sourceB.type) {
        throw new ValidationError(
            substitute(locale.illegalRuleOverrideTypeError, {
                property: prop,
                sourceType: sourceA.type,
                overrideType: sourceB.type,
            })
        )
    }
    switch (sourceA.type) {
        case XmlRuleType.ATTRIBUTE:
        case XmlRuleType.ELEMENT:
        case XmlRuleType.ELEMENTS: {
            const b = sourceB as ElementRule<any>
            if (
                sourceA.namespaceUri !== b.namespaceUri ||
                (sourceA.localPart ?? prop) !== (b.localPart ?? prop)
            ) {
                throw new ValidationError(
                    substitute(locale.illegalQNameOverrideError, {
                        property: prop,
                    })
                )
            }
            break
        }
    }

    switch (sourceA.type) {
        case XmlRuleType.ATTRIBUTE: {
            const b = sourceB as AttributeRule<any>
            return {
                ...b,
                default: b.default ?? sourceA.default,
            }
        }
        case XmlRuleType.CHARACTERS:
            return sourceB
        case XmlRuleType.ELEMENT: {
            const b = sourceB as ElementRule<any>
            return {
                ...b,
                required: sourceA.required || b.required,
                rules: mergeXmlRules(sourceA.rules, b.rules),
            }
        }
        case XmlRuleType.ELEMENTS: {
            const b = sourceB as ElementsRule<any>
            const maxOccurs =
                sourceA.maxOccurs != null && b.maxOccurs != null
                    ? Math.min(sourceA.maxOccurs, b.maxOccurs)
                    : (sourceA.maxOccurs ?? b.maxOccurs)
            return {
                ...b,
                minOccurs: Math.max(sourceA.minOccurs, b.minOccurs),
                maxOccurs,
                useEmptyArrays: sourceA.useEmptyArrays || b.useEmptyArrays,
                rules: mergeXmlRules(sourceA.rules, b.rules),
            }
        }
    }
}
