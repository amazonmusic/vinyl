/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    clone,
    type Cloneable,
    decodeEntities,
    IllegalStateError,
    last,
    substitute,
    toJson,
} from '@amazon/vinyl-util'

import type { XmlRules } from './xmlRules'
import type { MappedXmlRules } from './mappedXmlRules'
import { EmptyRules, mapXmlRules, xmlRuleKey } from './mappedXmlRules'
import type { Attributes, ParseXmlHandler } from './ParseXmlHandler'
import type { QName } from './QName'
import { XmlSchemaError, xmlSchemaErrorLocale } from './XmlSchemaError'

interface StackElement {
    /**
     * The current object being built.
     */
    readonly element: any

    /**
     * The current element's text content. This will be appended to on every {@link characters}
     * callback.
     */
    characters: string

    /**
     * The current element rules.
     */
    readonly rules: MappedXmlRules<any>
}

/**
 * Choose the rule using namespaces first, if there is no match, query the wildcard namespace rules.
 */
function getRule<T>(
    name: QName,
    rules: ReadonlyMap<string, T | undefined>
): T | undefined {
    return rules.get(xmlRuleKey(name.localPart, name.namespaceUri))
}

export interface ParseXmlHandlerOptions {
    readonly validateRules: boolean
}

/**
 * A {@link ParseXmlHandler} implementation that follows {@link XmlRules}, building an object of
 * the parameterized type.
 */
export class ParseXmlHandlerImpl<T> implements ParseXmlHandler<T> {
    private stack: StackElement[] = []

    private options: ParseXmlHandlerOptions
    private busy = false

    constructor(
        private readonly rules: MappedXmlRules<T>,
        options?: Partial<ParseXmlHandlerOptions>
    ) {
        this.options = { validateRules: true, ...options }
    }

    startDocument(): void {
        if (this.busy)
            throw new IllegalStateError('XML content handler is busy')
        this.busy = true
        const rules = this.rules
        this.stack.push({
            element: new XmlElementImpl(),
            rules,
            characters: '',
        })
    }

    startElement(name: QName, attributes: Attributes): void {
        const parent = last(this.stack)!
        let element: any = null
        const elementRule = getRule(name, parent.rules.elements)
        const rules = elementRule?.rules() ?? EmptyRules
        if (elementRule) {
            const prop = elementRule.property
            element = new XmlElementImpl(parent.element)
            if (elementRule.array) {
                const arr = parent.element[prop]
                if (Array.isArray(arr)) {
                    arr.push(element)
                } else {
                    parent.element[prop] = [element]
                }
            } else {
                if (parent.element[prop]) {
                    throw new XmlSchemaError(
                        `Expected single element with name ${name.qName}`
                    )
                } else {
                    parent.element[prop] = element
                }
            }

            const attributeRules = rules.attributes
            for (const k in attributes) {
                const attribute = attributes[k]!
                const name = attribute.name
                const attributeRule = getRule(name, attributeRules)
                if (attributeRule) {
                    element[attributeRule.property] = attributeRule.parse(
                        attribute.value
                    )
                }
            }

            // Set attribute defaults:
            attributeRules.forEach((_value, key) => {
                const rule = attributeRules.get(key)!
                if (!(rule.property in element)) {
                    if (rule.default != null) {
                        element[rule.property] = rule.default
                    } else if (this.options.validateRules && rule.required) {
                        throw new XmlSchemaError(
                            substitute(xmlSchemaErrorLocale.requiredAttribute, {
                                property: rule.property,
                            })
                        )
                    }
                }
            })
        }
        this.stack.push({
            element,
            rules,
            characters: '',
        })
    }

    textNode(str: string): void {
        const current = last(this.stack)!
        if (!current.rules.characters) return
        current.characters += decodeEntities(str.trim())
    }

    cDataNode(str: string): void {
        const current = last(this.stack)!
        if (!current.rules.characters) return
        current.characters += str
    }

    endElement(): void {
        const lastEl = this.stack.pop()!
        const charactersRule = lastEl.rules.characters
        if (charactersRule)
            lastEl.element[charactersRule.property] = charactersRule.parse(
                lastEl.characters
            )
        lastEl.rules.elements.forEach((rule) => {
            if (rule.array && !(rule.property in lastEl.element)) {
                if (rule.useEmptyArrays) {
                    lastEl.element[rule.property] = []
                }
            }
        })
        this.validate(lastEl)
    }

    endDocument(): T & XmlElement<T> {
        this.busy = false
        const last = this.stack.pop()!
        this.validate(last)
        return last.element
    }

    private validate(current: StackElement) {
        if (!this.options.validateRules) return
        current.rules.elements.forEach((rule) => {
            const length = rule.array
                ? (current.element[rule.property]?.length ?? 0)
                : current.element[rule.property]
                  ? 1
                  : 0
            if (length < rule.minOccurs) {
                throw new XmlSchemaError(
                    substitute(xmlSchemaErrorLocale.atLeastElements, {
                        property: rule.property,
                        expected: rule.minOccurs,
                        actual: length,
                    })
                )
            }
            if (rule.maxOccurs != null && length > rule.maxOccurs) {
                throw new XmlSchemaError(
                    substitute(xmlSchemaErrorLocale.atMostElements, {
                        property: rule.property,
                        expected: rule.maxOccurs,
                        actual: length,
                    })
                )
            }
        })
    }
}

/**
 * Creates an XML content handler for the given parsing rules.
 *
 * @param rules
 * @param options
 */
export function parseXmlHandler<T extends object>(
    rules: XmlRules<T>,
    options?: Partial<ParseXmlHandlerOptions>
): ParseXmlHandlerImpl<T> {
    return new ParseXmlHandlerImpl<T>(mapXmlRules(rules), options)
}

// Use a symbol to prevent parent from inclusion in property enumeration.
const parentSymbol = Symbol('parent')

export interface XmlElement<T = any> extends Cloneable<T & XmlElement<T>> {
    get parent(): XmlElement | null
    toJSON(): any
}

export class XmlElementImpl<T> implements XmlElement<T> {
    [prop: keyof any]: any

    private [parentSymbol]: XmlElement | null

    constructor(parent: XmlElement | null = null) {
        this[parentSymbol] = parent
    }

    get parent(): XmlElement | null {
        return this[parentSymbol]
    }

    set parent(value: XmlElement | null) {
        this[parentSymbol] = value
    }

    clone(): T & XmlElementImpl<T> {
        const out: any = new XmlElementImpl(this.parent)
        for (const key in this) {
            // Clone all children, setting their parent references to the new cloned parent.
            const child: any = clone(this[key])
            if (Array.isArray(child)) {
                for (const e of child) {
                    if (typeof e === 'object' && 'parent' in e) e.parent = out
                }
            } else if (typeof child === 'object' && 'parent' in child) {
                child.parent = out
            }
            out[key] = child
        }
        return out
    }

    toJSON(): any {
        const out: any = {}
        for (const key in this) {
            out[key] = toJson(this[key])
        }
        return out
    }
}
