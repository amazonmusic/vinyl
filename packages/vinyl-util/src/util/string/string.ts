/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError } from '@/error/IllegalArgumentError'
import { flipMap } from '@/util/map/map'
import type { Maybe } from '@/util/type'
import type { ReadonlyRecord } from '@/util/object/readonlyType'

/**
 * @private
 */
const locale = {
    variableNotDefined: "Variable '{name}' is not defined",
} as const

/**
 * The default substitution pattern, matching `{name}`.
 */
const DEFAULT_SUBSTITUTE_PATTERN = /\{(\w+)}/g

/**
 * Substitutes named variable references in a string.
 *
 * Example:
 * ```
 * substitute('{fruit}, {veg}', { fruit: 'apples', veg: 'carrots' }) // 'apples, carrots'
 * ```
 *
 * @param str The template string.
 * @param variables A record of variable names to values.
 * @param pattern A regex whose first capture group is the variable name. Defaults to `{name}`.
 * @throws IllegalArgumentError if a referenced variable is not defined.
 */
export function substitute(
    str: string,
    variables: Readonly<Record<string, any>>,
    pattern: RegExp = DEFAULT_SUBSTITUTE_PATTERN
): string {
    return str.replace(pattern, (_, name) => {
        if (!(name in variables)) {
            throw new IllegalArgumentError(
                locale.variableNotDefined.replace('{name}', String(name))
            )
        }
        return String(variables[name])
    })
}

/**
 * Replaces substitution tokens.
 *
 * Each identifier may be suffixed, within the enclosing '$' characters, with an additional format tag for number
 * padding following the prototype: `%0[width]d`
 * For example:
 * 'Segment_$Time%04d$' Where the `Time` property is `42` will have a replacement value of: `Segment_0042`
 */
export function substituteIdentifiers(
    str: string,
    props: ReadonlyRecord<string, string | number>
): string {
    return str.replace(/\$(\w*)(?:%0(\d+)d)?\$/g, (_, match, maxLength) => {
        if (!match) return '$'
        if (!(match in props)) {
            throw new IllegalArgumentError(
                `Template substitution token '${match}' was not understood`
            )
        }
        let prop = String(props[match])
        if (maxLength) prop = prop.padStart(maxLength, '0')
        return prop
    })
}

/**
 * Returns true if the character is one of: ' ', '\t', '\n', '\r'
 *
 * @param charCode The character code to test
 */
export function isWhitespaceChar(charCode: number): boolean {
    return (
        charCode === 0x20 || // ' ' (space)
        charCode === 0x09 || // '\t' (tab)
        charCode === 0x0d || // '\r' (carriage return)
        charCode === 0x0a //    '\n' (line feed)
    )
}

const encodedEntitiesRegex = /&(#(\d+)|\w+);/gi

/**
 * Predefined general xml entities
 * https://www.w3.org/TR/2008/REC-xml-20081126/#sec-predefined-ent
 */
export const predefinedDecodeEntities: ReadonlyMap<string, string> = new Map([
    ['apos', "'"],
    ['amp', '&'],
    ['lt', '<'],
    ['gt', '>'],
    ['quot', '"'],
])

/**
 * Replaces all specified entities with their mapped representations.
 * For example (using {@link predefinedDecodeEntities}):
 * ```
 * `&lt;Hello to y&apos;all&#33;&gt;` becomes `<Hello to y'all!>`
 * ```
 *
 * @param str
 * @param namedEntities
 */
export function decodeEntities(
    str: string,
    namedEntities: ReadonlyMap<string, string> = predefinedDecodeEntities
): string {
    if (encodedEntitiesRegex.test(str)) {
        return str.replace(
            encodedEntitiesRegex,
            (substring, entityName, codePoint) => {
                if (codePoint !== undefined)
                    return String.fromCharCode(parseInt(codePoint))
                const entityValue = namedEntities.get(entityName.toLowerCase())
                if (!entityValue) return substring
                return entityValue
            }
        )
    } else {
        return str
    }
}

const standardEntityValueToNames = flipMap(predefinedDecodeEntities)
const entitiesRegex = /['&<>"]/g

/**
 * Encodes the predefined xml standard entities into their entity names.
 *
 * & to &amp;
 * ' to &apos;
 * > to &gt;
 * < to &lt;
 * " to &quot;
 *
 * @param str
 */
export function encodeEntities(str: string): string {
    if (entitiesRegex.test(str)) {
        return str.replace(entitiesRegex, (entityValue) => {
            const entityName = standardEntityValueToNames.get(entityValue)
            return `&${entityName};`
        })
    } else {
        return str
    }
}

/**
 * Returns true if the two strings are equal, optionally ignoring case.
 *
 * @param a
 * @param b
 * @param ignoreCase
 */
export function eqStr(
    a: string | null,
    b: string | null,
    ignoreCase = false
): boolean {
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    if (a === b) return true
    if (ignoreCase)
        return a.length === b.length && a.toLowerCase() === b.toLowerCase()
    return false
}

/**
 * Given a single character string, returns the char code of the first character.
 *
 * @param str A single character string from which to get the first code point.
 */
export function char(str: string): number {
    return str.charCodeAt(0)
}

/**
 * Returns the substring of string after the last instance of searchString, excluding searchString.
 * If searchString is not found, the whole string will be returned.
 *
 * @param string
 * @param searchString
 * @param caseSensitive If true (default) the search will be case-sensitive.
 */
export function substringAfterLast(
    string: string,
    searchString: string,
    caseSensitive = true
): string {
    const i = (caseSensitive ? string : string.toLowerCase()).lastIndexOf(
        caseSensitive ? searchString : searchString.toLowerCase()
    )
    if (i === -1) return string
    return string.substring(i + searchString.length)
}

/**
 * Returns the substring of string before the first occurrence of searchString, excluding
 * searchString.
 * If searchString is not found, the whole string will be returned.
 *
 * @param string
 * @param searchString
 * @param caseSensitive If true (default) the search will be case-sensitive.
 */
export function substringBefore(
    string: string,
    searchString: string,
    caseSensitive = true
): string {
    const i = (caseSensitive ? string : string.toLowerCase()).indexOf(
        caseSensitive ? searchString : searchString.toLowerCase()
    )
    if (i === -1) return string
    return string.substring(0, i)
}

/**
 * Tokenizes a string into lowercase alphanumeric words.
 *
 * E.g. `'Amazon Music x86_64'` becomes `['amazon', 'music', 'x86', '64']`
 *
 * @param str
 */
export function tokenizeWords(str: string): string[] {
    const words: string[] = []
    const regex = /[a-z\d]+/gi
    let match: RegExpMatchArray | null
    while ((match = regex.exec(str))) {
        words.push(match[0].toLowerCase())
    }
    return words
}

export function toLowerCase<T extends string>(str: T): Lowercase<T> {
    return str.toLowerCase() as Lowercase<T>
}

export function toUpperCase<T extends string>(str: T): Uppercase<T> {
    return str.toUpperCase() as Uppercase<T>
}

/**
 * If the given string is greater than a max length, truncate the string with an indicator.
 * Example:
 * truncate('a very long string', 10) // 'a very ...'
 *
 * @param str A nullable string.
 * @param maxLength
 * @param indicator The string to indicate there was truncation, default is an ellipses … (U+2026)
 * @return Returns the truncated string, or the nullish value if str is nullish.
 */
export function truncate<T extends Maybe<string>>(
    str: T,
    maxLength: number,
    indicator = '…'
): T | string {
    if (str == null) return str
    if (str.length > maxLength)
        return str.substring(0, maxLength - indicator.length) + indicator
    return str
}

/**
 * Converts a string to kebab-case.
 *
 * This function transforms camelCase, PascalCase, snake_case, and space-separated
 * strings into a normalized kebab-case format. It removes non-alphanumeric characters
 * (excluding hyphens), collapses multiple delimiters, and trims leading/trailing hyphens.
 *
 * @example
 * toKebabCase("HelloWorld")         // "hello-world"
 * toKebabCase("hello_world test")   // "hello-world-test"
 * toKebabCase("SomeText123")        // "some-text123"
 *
 * @param str - The input string to convert.
 * @returns The kebab-case version of the input.
 */
export function toKebabCase(str: string): string {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
}
