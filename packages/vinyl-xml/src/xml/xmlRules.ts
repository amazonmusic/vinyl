/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A set of utilities for easily writing schema-based rule definitions to be used with the
 * `parseXml` parser.
 *
 * @module
 */

import {
    parseDate,
    stringifyDate,
    parseBoolean,
    stringify,
    type Invariant,
    type Maybe,
    type ReadonlyDate,
} from '@amazon/vinyl-util'

import type { Uri } from '@/xmlns/org/w3/2001/XmlSchema'

export enum XmlRuleType {
    CHARACTERS = 'characters',
    ATTRIBUTE = 'attribute',
    ELEMENT = 'element',
    ELEMENTS = 'elements',
}

/**
 * Reserved keys that may not be used in XmlRules.
 *
 * If a schema uses a reserved word, set `localPart` in the rule options to associate.
 */
export type ReservedXmlRuleKeys = 'parent' | 'clone' | 'toJSON'

/**
 * A schema for XML serialization and deserialization.
 *
 * The parser values may be lazy, represented as a function that returns a property parser.
 * @typeParam T The object type these parsing rules model.
 */
export type XmlRules<T extends object> = {
    readonly [P in Exclude<keyof T, ReservedXmlRuleKeys>]-?:
        | XmlRule<T[P]>
        | LazyXmlRule<T[P]>
}

/**
 * A union of the supported parsing types.
 */
export type XmlRule<T> =
    | AttributeRule<T>
    | CharactersRule<T>
    | ElementsRule<T & (readonly object[] | undefined)>
    | ElementRule<T & (object | undefined)>

/**
 * A function that returns a property handler.
 * Useful when there are recursive rules.
 */
export type LazyXmlRule<T> = () => XmlRule<T>

export interface NamespacedRuleOptions {
    /**
     * Matches the `QName.localPart` of the element. If undefined, this will match against
     * the property name from {@link XmlRules}.
     */
    readonly localPart?: string | undefined

    /**
     * Matches the `namespaceUri` of the element or attribute.
     *
     * If null, this will only match against a null namespace.
     * If undefined, this will default to the namespace of the parent element for elements, or
     * null for attributes.
     *
     * Note that attributes do not inherit default namespaces as elements do.
     */
    readonly namespaceUri?: Maybe<Uri>
}

/**
 * A rule definition for a list of elements.
 */
export interface ElementsRule<T extends readonly object[] | undefined>
    extends Required<ElementsRuleOptions> {
    readonly type: XmlRuleType.ELEMENTS

    /**
     * Prevents rule from losing nullable type information.
     */
    readonly __invariant?: Invariant<T>

    /**
     * Returns the schema for matched elements.
     * These rules will be applied per element, collecting into an array.
     */
    readonly rules: XmlRules<NonNullable<T>[number]>
}

export interface ElementsRuleOptions extends NamespacedRuleOptions {
    /**
     * The minimum number of elements.
     */
    readonly minOccurs?: number

    /**
     * The maximum number of elements. Use null for unbounded.
     */
    readonly maxOccurs?: number | null

    /**
     * If true and there are 0 occurrences of the element, the parsed value will be an empty array
     * instead of undefined.
     */
    readonly useEmptyArrays?: boolean
}

/**
 * A rule definition for a single element.
 */
export interface ElementRule<T extends object | undefined>
    extends Required<ElementRuleOptions> {
    /**
     * Prevents rule from losing nullable type information.
     */
    readonly __invariant?: Invariant<T>

    readonly type: XmlRuleType.ELEMENT

    /**
     * Returns the schema for the matched element.
     */
    readonly rules: XmlRules<NonNullable<T>>
}

export interface ElementRuleOptions extends NamespacedRuleOptions {
    /**
     * If true, a parsing error will be thrown if the value is undefined.
     */
    readonly required?: boolean
}

/**
 * A rule definition for an attribute.
 */
export interface AttributeRule<T> extends Required<AttributeRuleOptions<T>> {
    readonly type: XmlRuleType.ATTRIBUTE

    /**
     * Parses the attribute value.
     */
    readonly parse: (value: string) => T

    /**
     * Stringifies the value.
     */
    readonly stringify: (value: NonNullable<T>) => string
}

export interface AttributeRuleOptions<T> extends NamespacedRuleOptions {
    /**
     * If true, a parsing error will be thrown if the value is undefined.
     */
    readonly required?: boolean

    /**
     * If the current element has no matching attribute, default will be used.
     */
    readonly default?: T | undefined

    /**
     * Matches the `namespaceUri` of the attribute.
     *
     * If null, this will only match against a null namespace.
     *
     * Note that attributes do not inherit default namespaces as elements do.
     */
    readonly namespaceUri?: Uri | null
}

/**
 * A rule definition for an element's text content.
 */
export interface CharactersRule<T> {
    readonly type: XmlRuleType.CHARACTERS

    /**
     * Parses the unescaped/processed characters.
     * This will always be called, but characters may be an empty string if the element has no
     * text content.
     */
    readonly parse: (characters: string) => T

    /**
     * Stringifies the value.
     */
    readonly stringify: (value: NonNullable<T>) => string
}

export interface RequiredElementRuleOptions extends ElementRuleOptions {
    readonly required: true
}

export function element<T extends object>(
    rules: XmlRules<T>,
    options: RequiredElementRuleOptions
): ElementRule<T>

export function element<T extends object | undefined>(
    rules: XmlRules<NonNullable<T>>,
    options?: ElementRuleOptions
): ElementRule<T | undefined>

/**
 * Returns a schema for a single object based on a map of rules.
 *
 * If more than one element is found with a matching name, a `ParseError` is thrown.
 */
export function element<T extends object | undefined>(
    rules: XmlRules<NonNullable<T>>,
    options?: ElementRuleOptions
): ElementRule<T | undefined> {
    return {
        type: XmlRuleType.ELEMENT,
        localPart: undefined,
        namespaceUri: undefined,
        required: false,
        ...options,
        rules,
    }
}

/**
 * Elements options that guarantee that there is a non-null array.
 * For minOccurs types greater than 10, a type cast is required.
 */
export type RequiredElementsOptions =
    | (ElementsRuleOptions & { readonly useEmptyArrays: true })
    | (ElementsRuleOptions & {
          readonly minOccurs: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
      })

export function elements<T extends object>(
    rules: XmlRules<T>,
    options: RequiredElementsOptions
): ElementsRule<readonly T[]>

export function elements<T extends object>(
    rules: XmlRules<T>,
    options?: ElementsRuleOptions
): ElementsRule<readonly T[] | undefined>

/**
 * Handles a list of child nodes where each matching child node is parsed into a corresponding
 * object represented by the given rules.
 *
 * @param rules The parsing rules to use for each element.
 * @param options
 * @see parseChildNodes
 */
export function elements<T extends object>(
    rules: XmlRules<T>,
    options?: ElementsRuleOptions
): ElementsRule<readonly T[] | undefined> | ElementsRule<readonly T[]> {
    return {
        type: XmlRuleType.ELEMENTS,
        localPart: undefined,
        namespaceUri: undefined,
        minOccurs: 0,
        maxOccurs: null,
        useEmptyArrays: false,
        ...options,
        rules,
    }
}

/**
 * Parses the text content of the current element via the given parse and stringify functions.
 *
 * Does not currently support mixing text and element nodes.
 * E.g. the XML `<note>Dear <name>John</name>, I regret to inform you...</note>` could not be
 * serialized or deserialized using xml rule mappings.
 *
 * @param parse The string passed to this parser is the processed text content of the current
 * element.
 * @param stringify Serializes the value.
 *
 * @see processCharacters
 */
export function characters<T>(
    parse: (str: string) => T,
    stringify: (value: T) => string
): CharactersRule<T> {
    return { type: XmlRuleType.CHARACTERS, parse, stringify }
}

/**
 * Handles the processed text content without any modification.
 *
 * @see characters
 */
export const charactersString = characters((i) => i, stringify)

export type RequiredAttributeOptions<T> = AttributeRuleOptions<T> &
    ({ required: true } | { default: T })

export function attr<T>(
    parse: (value: string) => T,
    stringify: (value: T) => string,
    options: RequiredAttributeOptions<T>
): AttributeRule<T>

export function attr<T>(
    parse: (value: string) => T,
    stringify: (value: NonNullable<T>) => string,
    options?: AttributeRuleOptions<T>
): AttributeRule<T | undefined>

/**
 * Handles an attribute using the given parse and stringify functions.
 *
 * @param parse
 * @param stringify
 * @param options
 */
export function attr<T>(
    parse: (value: string) => T,
    stringify: (value: T) => string,
    options?: AttributeRuleOptions<T>
): AttributeRule<T> | AttributeRule<T | undefined> {
    return {
        type: XmlRuleType.ATTRIBUTE,
        localPart: undefined,
        namespaceUri: null,
        required: false,
        default: undefined,
        ...options,
        parse,
        stringify,
    }
}

export function attrString(
    options: RequiredAttributeOptions<string>
): AttributeRule<string>

export function attrString(
    options?: AttributeRuleOptions<string>
): AttributeRule<string | undefined>

/**
 * Keeps an attribute's string value as is.
 *
 * @param options
 */
export function attrString(
    options?: AttributeRuleOptions<string>
): AttributeRule<string> | AttributeRule<string | undefined> {
    return attr((i) => i, stringify, options)
}

export function attrInt(
    options: RequiredAttributeOptions<number>
): AttributeRule<number>

export function attrInt(
    options?: AttributeRuleOptions<number>
): AttributeRule<number | undefined>

/**
 * Parses an attribute's value using `parseInt`
 *
 * @param options
 */
export function attrInt(
    options?: AttributeRuleOptions<number>
): AttributeRule<number> | AttributeRule<number | undefined> {
    return attr(parseInt, stringify, options)
}

export function attrFloat(
    options: RequiredAttributeOptions<number>
): AttributeRule<number>

export function attrFloat(
    options?: AttributeRuleOptions<number>
): AttributeRule<number | undefined>

/**
 * Parses an attribute using `parseFloat`
 *
 * @param options
 */
export function attrFloat(
    options?: AttributeRuleOptions<number>
): AttributeRule<number> | AttributeRule<number | undefined> {
    return attr(parseFloat, stringify, options)
}

export function attrBoolean(
    options: RequiredAttributeOptions<boolean>
): AttributeRule<boolean>

export function attrBoolean(
    options?: AttributeRuleOptions<boolean>
): AttributeRule<boolean | undefined>

/**
 * Parses an attribute's value `"true"` or `"1"` as `true`.
 *
 * @param options
 */
export function attrBoolean(
    options?: AttributeRuleOptions<boolean>
): AttributeRule<boolean> | AttributeRule<boolean | undefined> {
    return attr(parseBoolean, stringify, options)
}

export function attrDateTime(
    options: RequiredAttributeOptions<Date>
): AttributeRule<ReadonlyDate>

export function attrDateTime(
    options?: AttributeRuleOptions<ReadonlyDate>
): AttributeRule<ReadonlyDate | undefined>

/**
 * Parses an attribute using `Date.parse`
 *
 * @param options
 */
export function attrDateTime(
    options?: AttributeRuleOptions<ReadonlyDate>
): AttributeRule<ReadonlyDate> | AttributeRule<ReadonlyDate | undefined> {
    return attr(parseDate, stringifyDate, options)
}
