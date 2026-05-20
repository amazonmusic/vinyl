/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    IllegalArgumentError,
    invariant,
    type Invariant,
    memoize,
} from '@amazon/vinyl-util'

import type { XmlRule, XmlRules } from './xmlRules'
import { XmlRuleType } from './xmlRules'
import type { Uri } from '@/xmlns/org/w3/2001/XmlSchema'

/**
 * A machine-readable representation of parse rules for random access based on qualified namespace
 * keys.
 *
 * Rule keys will either be `namespaceUri:localPart` or just `localPart` for wildcard rules if
 * namespaceUri is not defined in the handler.
 */
export interface MappedXmlRules<T> {
    /**
     * Enforces that this rule set can only be used to parse the expected type T.
     */
    readonly __type: Invariant<T>
    readonly attributes: ReadonlyMap<string, MappedAttributeRule>
    readonly elements: ReadonlyMap<string, MappedElementsRule>
    readonly characters: MappedCharactersRule | undefined
}

export interface MappedAttributeRule {
    /**
     * The property name.
     */
    readonly property: keyof any

    /**
     * If true, a parsing error will be thrown if the value is undefined.
     */
    readonly required: boolean

    /**
     * If the current element has no matching attribute, default will be used.
     */
    readonly default: any

    /**
     * Parses the attribute value.
     */
    readonly parse: (value: string) => any

    /**
     * Converts the attribute value to a string.
     */
    readonly stringify: (value: any) => string

    /**
     * The local part of the QName.
     */
    readonly localPart: string

    /**
     * The namespace uri that must match.
     */
    readonly namespaceUri: Uri | null
}

export interface MappedElementsRule {
    /**
     * The name of the property to set on the parent element.
     */
    readonly property: keyof any

    /**
     * True if the parsed elements should populate into an array.
     */
    readonly array: boolean

    /**
     * The minimum number of elements.
     */
    readonly minOccurs: number

    /**
     * The maximum number of elements. Use null for unbounded.
     */
    readonly maxOccurs: number | null

    /**
     * If true and there are 0 occurrences of the element, the parsed value will be an empty array
     * instead of undefined.
     */
    readonly useEmptyArrays: boolean

    /**
     * Returns the mappings for matched element(s).
     */
    readonly rules: () => MappedXmlRules<any>

    /**
     * The local part of the QName.
     */
    readonly localPart: string

    /**
     * The namespace uri that must match.
     */
    readonly namespaceUri: Uri | null
}

export interface MappedCharactersRule {
    readonly property: keyof any

    /**
     * Parses the unescaped/processed characters.
     * This will always be called, but characters may be an empty string if the element has no
     * text content.
     */
    readonly parse: (characters: string) => any

    /**
     * Converts the value to a string.
     */
    readonly stringify: (value: any) => string
}

/**
 * An empty rules map, used when there was no match for the started element.
 * @private
 */
export const EmptyRules: MappedXmlRules<AnyRecord> = {
    __type: invariant(),
    attributes: new Map(),
    elements: new Map(),
    characters: undefined,
} as const

/**
 * Creates machine-friendly content handler rules from the given {@link XmlRules}.
 *
 * @param rules The {@link XmlRules} to convert.
 * @param parentNamespaceUri
 */
export function mapXmlRules<T extends object>(
    rules: XmlRules<T>,
    parentNamespaceUri: Uri | null = null
): MappedXmlRules<T> {
    const attributeRules = new Map<string, MappedAttributeRule>()
    const elementRules = new Map<string, MappedElementsRule>()
    let charactersRule: MappedCharactersRule | undefined = undefined

    for (const property in rules) {
        const handlerOrFunction = rules[property as keyof typeof rules]
        let handler: XmlRule<any>
        if (typeof handlerOrFunction === 'function') {
            handler = handlerOrFunction()
        } else {
            handler = handlerOrFunction
        }
        let key: string
        switch (handler.type) {
            case XmlRuleType.CHARACTERS:
                if (charactersRule !== undefined)
                    throw new IllegalArgumentError(
                        'characters handler already defined'
                    )
                charactersRule = {
                    property,
                    parse: handler.parse,
                    stringify: handler.stringify,
                }
                break
            case XmlRuleType.ELEMENT:
            case XmlRuleType.ELEMENTS: {
                const localPart = handler.localPart ?? property
                const namespaceUri: Uri | null =
                    handler.namespaceUri === undefined
                        ? parentNamespaceUri
                        : handler.namespaceUri
                key = xmlRuleKey(localPart, namespaceUri)
                if (elementRules.has(key)) {
                    throw new IllegalArgumentError(
                        `Multiple element rules for ${key}`
                    )
                }
                if (handler.type === XmlRuleType.ELEMENT) {
                    const rules = handler.rules
                    elementRules.set(key, {
                        array: false,
                        property,
                        minOccurs: handler.required ? 1 : 0,
                        maxOccurs: 1,
                        rules: memoize(() => mapXmlRules(rules, namespaceUri)),
                        useEmptyArrays: false,
                        localPart,
                        namespaceUri,
                    })
                } else {
                    const rules = handler.rules
                    elementRules.set(key, {
                        array: true,
                        property,
                        maxOccurs: handler.maxOccurs,
                        minOccurs: handler.minOccurs,
                        rules: memoize(() => mapXmlRules(rules, namespaceUri)),
                        useEmptyArrays: handler.useEmptyArrays,
                        localPart,
                        namespaceUri,
                    })
                }
                break
            }
            case XmlRuleType.ATTRIBUTE: {
                // Attributes should not inherit the namespace of the parent element.
                const namespaceUri = handler.namespaceUri
                const localPart = handler.localPart ?? property
                key = xmlRuleKey(localPart, namespaceUri)
                if (attributeRules.has(key)) {
                    throw new IllegalArgumentError(
                        `Multiple attribute rules for ${key}`
                    )
                }
                attributeRules.set(key, {
                    property,
                    default: handler.default,
                    parse: handler.parse,
                    stringify: handler.stringify,
                    required: handler.required,
                    localPart,
                    namespaceUri: handler.namespaceUri ?? null,
                })
                break
            }
        }
    }
    return {
        __type: invariant(),
        attributes: attributeRules,
        elements: elementRules,
        characters: charactersRule,
    }
}

/**
 * Creates a rule key for mapped xml rules.
 *
 * @private
 * @param localPart The {@link QName.localPart}
 * @param namespaceUri The `namespaceUri` of the element.
 */
export function xmlRuleKey(
    localPart: string,
    namespaceUri: Uri | null = null
): string {
    return `${namespaceUri ?? ''}:${localPart}`
}
