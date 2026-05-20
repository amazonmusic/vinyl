/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    encodeEntities,
    equalDeep,
    getOrSet,
    type OptionalDeep,
    substitute,
} from '@amazon/vinyl-util'

import type { Uri } from '@/xmlns/org/w3/2001/XmlSchema'
import type {
    MappedAttributeRule,
    MappedCharactersRule,
    MappedElementsRule,
    MappedXmlRules,
} from './mappedXmlRules'
import { XmlSchemaError, xmlSchemaErrorLocale } from './XmlSchemaError'
import type { ReservedXmlRuleKeys } from '@/xml/xmlRules'

/**
 * @private
 */
const locale = {
    /**
     * When a namespace binding is generated, if the prefix was not provided in the stringifier
     * options, it will be generated from this template.
     */
    prefixTemplate: 'ns_{value}',
} as const

export interface StringifyOptions {
    /**
     * The indentation. Default: 4 spaces
     */
    readonly indent: string

    /**
     * The character(s) between lines. Default: \n
     */
    readonly newline: string

    /**
     * A map of namespace uri to prefix strings.
     * If a namespace is not found, a prefix will be generated.
     */
    readonly prefixMap: ReadonlyMap<Uri, string>

    /**
     * If true, will include the XML declaration at the beginning of the stringified document.
     * `<?xml version="1.0"?>`
     */
    readonly includeXmlDeclaration: boolean
}

const defaultStringifyOptions: StringifyOptions = {
    indent: '    ',
    newline: '\n',
    prefixMap: new Map(),
    includeXmlDeclaration: true,
}

export class XmlWriter<T> {
    private readonly options: StringifyOptions
    private readonly usedPrefixes = new Map<Uri, string>()
    private readonly traversed = new Set()

    constructor(
        private readonly rules: MappedXmlRules<T>,
        options?: Partial<StringifyOptions>
    ) {
        this.options = {
            ...defaultStringifyOptions,
            ...options,
        }
    }

    stringify(object: OptionalDeep<T, ReservedXmlRuleKeys>): string {
        let str = this.options.includeXmlDeclaration
            ? '<?xml version="1.0"?>' + this.options.newline
            : ''
        const state = new StringifyState()
        str += this.stringifyChildren(object, this.rules.elements, state)
        this.usedPrefixes.clear()
        this.traversed.clear()

        return str
    }

    private qName(localPart: string, namespaceUri: Uri | null): string {
        if (!namespaceUri) return localPart
        const prefixMap = this.options.prefixMap
        const prefix = getOrSet(this.usedPrefixes, namespaceUri, () => {
            if (prefixMap.has(namespaceUri)) {
                return prefixMap.get(namespaceUri)!
            }
            return substitute(locale.prefixTemplate, {
                value: (this.usedPrefixes.size + 1).toString(36),
            })
        })
        return `${prefix}:${localPart}`
    }

    /**
     * Stringifies an element.
     *
     * @param object
     * @param rule
     * @param state
     */
    private stringifyElement(
        object: any,
        rule: MappedElementsRule,
        state: StringifyState
    ): string {
        if (this.traversed.has(object))
            throw new XmlSchemaError(xmlSchemaErrorLocale.cyclicReferences)
        this.traversed.add(object)
        const nl = this.options.newline
        const isDocument = state.depth === 0
        let namespaces = ''

        let xmlns = state.xmlns
        if (
            xmlns !== rule.namespaceUri &&
            (xmlns == null || !rule.namespaceUri)
        ) {
            // The element's namespace is different from the parent.
            // Change the default namespace if moving to or from a null namespace.
            xmlns = rule.namespaceUri
            namespaces += ` xmlns="${rule.namespaceUri ?? ''}"`
        }

        const childState = state.createChild(xmlns, this.options.indent)
        const rules = rule.rules()
        const attributes = this.stringifyAttributes(object, rules.attributes)
        const children = this.stringifyChildren(
            object,
            rules.elements,
            childState
        )
        const text = this.stringifyCharacters(object, rules.characters)

        if (isDocument) {
            this.usedPrefixes.forEach((prefix, uri) => {
                namespaces += ` xmlns:${prefix}="${uri}"`
            })
        }

        const indent = state.indent
        const childIndent = childState.indent
        const qName =
            rule.namespaceUri === xmlns
                ? rule.localPart
                : this.qName(rule.localPart, rule.namespaceUri)
        let str = `${indent}<${qName}${namespaces}${attributes}`
        if (children) {
            str += `>`
            if (text) str += `${nl}${childIndent}${text}`
            str += nl + children
            str += `${nl}${indent}</${qName}>`
        } else if (text) {
            str += `>${text}</${qName}>`
        } else {
            str += '/>'
        }
        return str
    }

    /**
     * Stringifies an element's attributes.
     *
     * @param object
     * @param attributes
     * @return Returns the attributes string. This will include a leading space if there are any
     * found attributes.
     */
    private stringifyAttributes(
        object: any,
        attributes: ReadonlyMap<string, MappedAttributeRule>
    ): string {
        let str = ''
        attributes.forEach((attributeRule) => {
            const propertyValue = object[attributeRule.property]
            if (propertyValue !== undefined) {
                const attributeValue = attributeRule.stringify(propertyValue)
                if (
                    attributeRule.default === undefined ||
                    !equalDeep(propertyValue, attributeRule.default)
                ) {
                    str += ` ${this.qName(
                        attributeRule.localPart,
                        attributeRule.namespaceUri
                    )}="${encodeEntities(attributeValue)}"`
                }
            } else {
                if (attributeRule.required) {
                    throw new XmlSchemaError(
                        substitute(xmlSchemaErrorLocale.requiredAttribute, {
                            property: attributeRule.property,
                        })
                    )
                }
            }
        })
        return str
    }

    /**
     * Stringifies a property as a CDATA node.
     *
     * @param object
     * @param charactersRule
     */
    private stringifyCharacters(
        object: any,
        charactersRule: MappedCharactersRule | undefined
    ): string | null {
        if (!charactersRule) return null
        const str = charactersRule.stringify(object[charactersRule.property])
        if (!str) return ''
        return `<![CDATA[${str}]]>`
    }

    /**
     * Stringifies an element's child elements.
     *
     * @param object
     * @param elements
     * @param state
     */
    private stringifyChildren(
        object: any,
        elements: ReadonlyMap<string, MappedElementsRule>,
        state: StringifyState
    ): string {
        let str = ''
        elements.forEach((elementsRule) => {
            const child: any = object[elementsRule.property]
            if (child) {
                if (elementsRule.array) {
                    const arr: any[] = child
                    if (elementsRule.minOccurs > arr.length) {
                        throw new XmlSchemaError(
                            substitute(xmlSchemaErrorLocale.atLeastElements, {
                                property: elementsRule.property,
                                expected: elementsRule.minOccurs,
                                actual: arr.length,
                            })
                        )
                    }
                    if (
                        elementsRule.maxOccurs != null &&
                        elementsRule.maxOccurs < arr.length
                    ) {
                        throw new XmlSchemaError(
                            substitute(xmlSchemaErrorLocale.atMostElements, {
                                property: elementsRule.property,
                                expected: elementsRule.maxOccurs,
                                actual: arr.length,
                            })
                        )
                    }
                    for (const element of arr) {
                        if (str) str += this.options.newline
                        str += this.stringifyElement(
                            element,
                            elementsRule,
                            state
                        )
                    }
                } else {
                    if (str) str += this.options.newline
                    str += this.stringifyElement(child, elementsRule, state)
                }
            } else {
                if (elementsRule.minOccurs > 0) {
                    throw new XmlSchemaError(
                        substitute(xmlSchemaErrorLocale.atLeastElements, {
                            property: elementsRule.property,
                            expected: elementsRule.minOccurs,
                            actual: 0,
                        })
                    )
                }
            }
        })
        return str
    }
}

class StringifyState {
    constructor(
        readonly depth: number = 0,
        readonly xmlns: Uri | null = null,
        readonly indent: string = ''
    ) {}

    createChild(xmlns: Uri | null, indent: string): StringifyState {
        return new StringifyState(this.depth + 1, xmlns, this.indent + indent)
    }
}

export function stringifyXml<T>(
    object: OptionalDeep<T, ReservedXmlRuleKeys>,
    rules: MappedXmlRules<T>,
    options?: Partial<StringifyOptions>
): string {
    const writer = new XmlWriter(rules, options)
    return writer.stringify(object)
}
