/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    char,
    decodeEntities,
    last,
    type MutableDeep,
    StringReader,
} from '@amazon/vinyl-util'

import type { Uri } from '@/xmlns/org/w3/2001/XmlSchema'
import type { Attributes, ParseXmlHandler } from './ParseXmlHandler'
import type { QName } from './QName'
import type { XmlElement } from './ParseXmlHandlerImpl'

export const XMLNS = 'http://www.w3.org/2000/xmlns/'

const LT = char('<')
const GT = char('>')
const EQ = char('=')
const SLASH = char('/')
const COLON = char(':')
const QMARK = char('?')
const EXCL = char('!')
const APOS = char("'")
const QUOT = char('"')
const QUOTES = new Set([APOS, QUOT])

/**
 * Nested xml elements push current namespace information onto a stack.
 *
 * @private
 */
export interface StackElement {
    /**
     * The qualified name of the current element on the stack. Used to validate expected closing
     * element.
     */
    readonly qName: string

    /**
     * The (mutable) namespaces map for the current stack.
     */
    readonly namespaceMap: Namespaces

    /**
     * The default namespace.
     */
    defaultNamespaceUri: Uri | null
}

/**
 * Parses an XML document using a partial sax-style content handler.
 * This allows for parsing without the entire document being read into memory first.
 *
 * XML Documents are mapped to data structures through content handlers instead of needing an
 * intermediate model.
 */
export function parseXml<T>(
    str: string,
    handler: ParseXmlHandler<T>
): T & XmlElement<T> {
    const c = new StringReader(str)
    let current: StackElement = {
        qName: '#document',
        namespaceMap: new Map(),
        defaultNamespaceUri: null,
    }
    const stack: StackElement[] = [current]

    /**
     * Provides the namespace uri for the given prefix on the current stack.
     * @param prefix
     */
    const namespaceLookup = (prefix: string | null): Uri | null => {
        if (!prefix) return current.defaultNamespaceUri
        for (let i = stack.length - 1; i >= 0; i--) {
            const map = stack[i].namespaceMap
            if (map.has(prefix)) return stack[i].namespaceMap.get(prefix)!
        }
        return null
    }

    try {
        handler.startDocument()
    } catch (e: any) {
        c.err(e.message)
    }
    while (c.hasNext()) {
        const charsStart = c.untilChar(LT)
        if (charsStart < c.position) {
            const chars = str.substring(charsStart, c.position)
            try {
                handler.textNode(chars)
            } catch (e: any) {
                c.err(e.message)
            }
        }
        if (!c.hasNext()) break // eos
        c.next() // <
        if (c.charIf(SLASH)) {
            // </ prepare for ending the element.
            c.white()
            const name = readQName(c)
            if (name.qName !== current.qName)
                c.err(`Expected </${current.qName}> but was </${name.qName}>`)
            stack.pop()
            current = last(stack)!
            c.white()
            c.readChar(GT)
            try {
                handler.endElement()
            } catch (e: any) {
                c.err(e.message)
            }
        } else if (c.charIf(QMARK)) {
            // <? Processing instruction
            untilTagClose(c)
        } else if (c.charIf(EXCL)) {
            // <! Declaration
            if (c.charIf(0x2d /* - */)) {
                c.readChar(0x2d)
                // <!-- Comment
                c.untilString('-->')
                c.read('-->')
            } else if (c.stringIf('[CDATA[')) {
                // <![CDATA[
                const charsStart = c.untilString(']]>')
                try {
                    handler.cDataNode(str.substring(charsStart, c.position))
                } catch (e: any) {
                    c.err(e.message)
                }
                c.read(']]>')
            } else {
                // <! Declaration
                untilTagClose(c)
            }
        } else {
            // < Prepare for beginning the element
            // Create a new stack element, inheriting the namespaces of the parent.
            const name: MutableDeep<QName> = readQName(c)
            current = {
                qName: name.qName,
                namespaceMap: new Map(),
                defaultNamespaceUri: current.defaultNamespaceUri,
            }
            stack.push(current)
            const attributes = xmlAttributes(c, current)
            // The namespaces can only be looked up after all attributes are parsed;
            // a namespace prefix may be defined after it's used on the same element.
            name.namespaceUri = namespaceLookup(name.prefix)
            for (const attributesKey in attributes) {
                const value = attributes[attributesKey]!
                const name = value.name
                // Attributes do not inherit the default namespace.
                if (name.prefix && !name.namespaceUri) {
                    name.namespaceUri = namespaceLookup(name.prefix)
                }
            }

            try {
                handler.startElement(name, attributes)
            } catch (e: any) {
                c.err(e.message)
            }
            if (c.charIf(SLASH)) {
                c.readChar(GT)
                stack.pop()
                current = last(stack)!
                // Closed tag <example/>
                try {
                    handler.endElement()
                } catch (e: any) {
                    c.err(e.message)
                }
            } else {
                c.readChar(GT)
            }
        }
    }
    try {
        return handler.endDocument()
    } catch (e: any) {
        return c.err(e.message)
    }
}

/**
 * @private
 */
export type Namespaces = Map<string, Uri | null>

// noinspection GrazieInspection
/**
 * Given that the cursor is at a ' or ", reads the sequence of characters until an end quote is
 * reached.
 * The returned unescaped string is the text within the quotes.
 * @private
 */
export function readAttributeValue(c: StringReader): string {
    const quote = c.next()
    if (!QUOTES.has(quote)) c.err('Expected \' or "')
    const value = c.substringUntil((charCode) => charCode === quote)
    c.readChar(quote)
    return decodeEntities(value)
}

/**
 * Reads until the end of the tag >
 * @private
 */
export function untilTagClose(c: StringReader): void {
    while (true) {
        c.until((c) => c === APOS || c === QUOT || c === GT)
        const char = c.next()
        if (QUOTES.has(char)) {
            c.untilChar(char)
            c.next()
        } else {
            // >
            break
        }
    }
}

/**
 * Returns true if the char code is a valid xml name character.
 * @see https://www.w3.org/TR/2008/REC-xml-20081126/#NT-NameChar
 * @param charCode
 * @private
 */
export function isNameChar(charCode: number): boolean {
    if (charCode >= 0x61 /* a */) {
        if (charCode >= 0xb7 /* · */) {
            if (charCode >= 0x300) {
                if (charCode >= 0x203f) {
                    return charCode <= 0x2040
                } else {
                    return charCode <= 0x36f
                }
            } else {
                return charCode === 0xb7 /* · */
            }
        } else {
            return charCode <= 0x7a /* z */
        }
    } else {
        if (charCode >= 0x5f /* _ */) {
            return charCode === 0x5f
        } else {
            if (charCode >= 0x41 /* A */) {
                return charCode <= 0x5a /* Z */
            } else {
                if (charCode >= 0x2d /* - */) {
                    if (charCode >= 0x30 /* 0 */) {
                        return charCode <= 0x39 /* 9 */
                    } else {
                        return charCode <= 0x2e /* . */
                    }
                } else {
                    return false
                }
            }
        }
    }
}

/**
 * Reads an xml {@link QName}.
 * The {@link QName.namespaceUri} returned will be null; it must be separately looked up.
 *
 * @param reader The current string reader.
 * @private
 */
export function readQName(reader: StringReader): MutableDeep<QName> {
    const prefixOrLocalName = reader.substringWhile(isNameChar)
    let prefix: string | null, localPart: string, name: string
    if (reader.charIf(COLON)) {
        prefix = prefixOrLocalName
        localPart = reader.substringWhile(isNameChar)
        name = `${prefix}:${localPart}`
    } else {
        prefix = null
        localPart = prefixOrLocalName
        name = localPart
    }
    return { prefix, localPart, qName: name, namespaceUri: null }
}

/**
 * Reads a series of xml attributes, separated by whitespace.
 * Example: `ns1:key1="value1" key2 key3='value3'`
 * Note: consumes all whitespace before and after attributes series.
 *
 * @return Returns a map of attribute `qName:string` to `Attribute` objects.
 *
 * @private
 */
export function xmlAttributes(
    reader: StringReader,
    stackElement: StackElement
): MutableDeep<Attributes> {
    const attributes: MutableDeep<Attributes> = {}
    while (true) {
        reader.white()
        if (!isNameChar(reader.peek)) break
        const name = readQName(reader)
        reader.white()
        let value = ''
        if (reader.charIf(EQ)) {
            reader.white()
            value = readAttributeValue(reader)
        } else {
            // Attributes without values are valid in html, but not xml
        }

        if (name.prefix === 'xmlns') {
            name.namespaceUri = XMLNS
            stackElement.namespaceMap.set(
                name.localPart,
                value === '' ? null : value
            )
        } else if (!name.prefix && name.localPart === 'xmlns') {
            name.namespaceUri = XMLNS
            stackElement.defaultNamespaceUri = !value ? null : value
        }
        if (attributes[name.qName] != null)
            reader.err(`Attribute '${name.qName}' is already specified.`)
        attributes[name.qName] = { name, value }
    }
    return attributes
}
