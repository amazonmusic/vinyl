/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Attributes,
    isNameChar,
    parseXml,
    type ParseXmlHandler,
    type QName,
    readAttributeValue,
    readQName,
    type StackElement,
    untilTagClose,
    type Uri,
    xmlAttributes,
    type XmlElement,
    XmlElementImpl,
} from '@amazon/vinyl-xml'

import {
    type AnyRecord,
    char,
    decodeEntities,
    last,
    StringParseError,
    StringReader,
} from '@amazon/vinyl-util'
import any = jasmine.any
import createSpy = jasmine.createSpy

const xmlElement = {
    clone: createSpy('clone'),
    toJSON: createSpy('toJSON'),
    parent: null,
}

describe('parseXml', () => {
    describe('xmlName', () => {
        it('reads an xml name with a prefix', () => {
            const s = new StringReader('prefix:test')
            expect(readQName(s)).toEqual({
                prefix: 'prefix',
                localPart: 'test',
                namespaceUri: null,
                qName: 'prefix:test',
            })

            const s2 = new StringReader('<pre2:local_.test>')
            s2.next()
            expect(readQName(s2)).toEqual({
                prefix: 'pre2',
                localPart: 'local_.test',
                namespaceUri: null,
                qName: 'pre2:local_.test',
            })
        })
    })

    describe('isNameChar', () => {
        // The formal definition of an XML NCName character:
        // Source: https://www.w3.org/TR/2008/REC-xml-20081126/#NT-NameChar

        it('returns true if the character is a valid xml name', () => {
            const nonNameChars = [
                char('='),
                char(':'),
                char(' '),
                char('\t'),
                char('<'),
                char('>'),
                char('\n'),
                0xb7 - 1,
                0x0300 - 1,
                0x036f + 1,
                0x203f - 1,
                0x2040 + 1,
            ]
            for (const nonNameChar of nonNameChars) {
                expect(isNameChar(nonNameChar))
                    .withContext(
                        `Expected '${String.fromCharCode(
                            nonNameChar
                        )}' not to be a name character`
                    )
                    .toBeFalse()
            }
            const nameChars = [
                char('a'),
                char('y'),
                char('z'),
                char('A'),
                char('B'),
                char('Z'),
                char('.'),
                char('_'),
                char('-'),
                char('3'),
                char('0'),
                char('9'),
                0xb7,
                0x0300,
                0x036f,
                0x203f,
                0x2040,
            ]
            for (const nameChar of nameChars) {
                expect(isNameChar(nameChar))
                    .withContext(
                        `Expected '${String.fromCharCode(
                            nameChar
                        )}' to be a name character`
                    )
                    .toBeTrue()
            }
        })
    })

    describe('attributeValue', () => {
        it('returns the string between a pair of single or double quotes', () => {
            const s = new StringReader(`"This is a string"'AnotherString'`)
            expect(readAttributeValue(s)).toBe('This is a string')
            expect(readAttributeValue(s)).toBe('AnotherString')
        })

        it('ends on the matching quote type', () => {
            const s = new StringReader(`"This is' a string"'Another"String'`)
            expect(readAttributeValue(s)).toBe(`This is' a string`)
            expect(readAttributeValue(s)).toBe('Another"String')
        })

        it('throws when begin quote is not found', () => {
            const s = new StringReader(`No begin quote`)
            expect(() => readAttributeValue(s)).toThrowMatching(isParseError)
        })

        it('throws when end quote is not found', () => {
            const s = new StringReader(`"This is' a string`)
            expect(() => readAttributeValue(s)).toThrowMatching(isParseError)
        })

        it('decodes its contents', () => {
            const s = new StringReader(
                `"&quot;&apos;This &amp; That&apos;&quot;"`
            )
            expect(readAttributeValue(s)).toBe(`"'This & That'"`)
        })
    })

    describe('xmlAttributes', () => {
        it('reads a series of key value pairs', () => {
            const s = new StringReader(`ns1:key1="value1" key2 key3 = 'value3'`)
            const stackElement: StackElement = {
                qName: '',
                namespaceMap: new Map(),
                defaultNamespaceUri: null,
            }
            const attributes = xmlAttributes(s, stackElement)
            expect(attributes).toEqual({
                'ns1:key1': {
                    name: {
                        prefix: 'ns1',
                        localPart: 'key1',
                        namespaceUri: null,
                        qName: 'ns1:key1',
                    },
                    value: 'value1',
                },
                key2: {
                    name: {
                        prefix: null,
                        localPart: 'key2',
                        namespaceUri: null,
                        qName: 'key2',
                    },
                    value: '',
                },
                key3: {
                    name: {
                        prefix: null,
                        localPart: 'key3',
                        namespaceUri: null,
                        qName: 'key3',
                    },
                    value: 'value3',
                },
            })
        })

        describe('when attribute is xmlns', () => {
            it('sets defaultNamespaceUri', () => {
                const s = new StringReader(
                    `ns1:key1="value1" xmlns='example.com' key3='value3'`
                )
                const stack: StackElement = {
                    qName: '',
                    defaultNamespaceUri: null,
                    namespaceMap: new Map(),
                }
                xmlAttributes(s, stack)
                expect(stack.defaultNamespaceUri).toBe('example.com')
            })
        })
    })

    describe('untilTagClose', () => {
        it('reads until >', () => {
            const s = new StringReader('<!DOCTYPE html><another></another>')
            untilTagClose(s)
            expect(s.position).toBe('<!DOCTYPE html>'.length)
            untilTagClose(s)
            expect(s.position).toBe('<!DOCTYPE html><another>'.length)
            untilTagClose(s)
            expect(s.position).toBe(s.data.length)
        })

        it('skips > characters within quotes', () => {
            const s = new StringReader(
                `<question check="dogs > cats" answer='<>'><question test=">>>>">`
            )
            untilTagClose(s)
            expect(s.position).toBe(
                '<question check="dogs > cats" answer=\'<>\'>'.length
            )
            untilTagClose(s)
            expect(s.position).toBe(s.data.length)
        })
    })

    describe('parseXml', () => {
        const mockHandler: ParseXmlHandler<AnyRecord> = {
            endDocument(): XmlElement {
                return new XmlElementImpl()
            },
            textNode(): void {},
            cDataNode(): void {},
            endElement(): void {},
            startDocument(): void {},
            startElement(): void {},
        } as const

        interface XmlAttributeStruct {
            name: QName
            value: string
        }

        interface XmlElementStruct extends XmlElement<XmlElementStruct> {
            name: QName
            characters?: string
            attributes?: { [key: string]: XmlAttributeStruct | undefined }
            children?: XmlElementStruct[]
        }

        /**
         * A utility to path into the XmlElementStruct
         * @param element
         * @param path Supports qNames separated by dots and optional array index access.
         *   Example: 'document.body.p[3].a[2]'
         */
        function x(element: XmlElementStruct, path: string): XmlElementStruct {
            let p: XmlElementStruct = element
            path.split('.').forEach((part) => {
                const indexedMatch = part.match(/([\w:]+)\[(\d+)]/)
                let index = 0
                let qName = part
                if (indexedMatch) {
                    qName = indexedMatch[1]
                    index = parseInt(indexedMatch[2])
                }
                let c = index
                const foundChild = p.children!.find(
                    (child) => child.name.qName === qName && c-- === 0
                )
                if (foundChild == null) {
                    throw new Error(
                        `Could not find child with qName ${qName} in path ${path}`
                    )
                }
                p = foundChild
            })
            return p
        }

        /**
         * Builds an object tree representing the parsed xml.
         *
         * - Uses a stack for nested elements
         * - Only sets attributes and characters if non-empty.
         * - Concatenates character data
         * - Returns the root object on endDocument
         * - Element lists with a length of 1 are treated as objects, element lists with a length of
         * greater than one are treated as arrays.
         *
         */
        class TestContentHandler implements ParseXmlHandler<XmlElementStruct> {
            stack: XmlElementStruct[] = [
                { ...xmlElement, name: name('#document') },
            ]

            startDocument(): void {}

            startElement(name: QName, attributes: Attributes): void {
                const parent = last(this.stack)!
                const newNode: XmlElementStruct = {
                    name,
                    ...xmlElement,
                }
                if (Object.keys(attributes).length > 0)
                    newNode.attributes = attributes
                if (parent.children === undefined) parent.children = []
                parent.children.push(newNode)
                this.stack.push(newNode)
            }

            textNode(str: string): void {
                const processed = decodeEntities(str)
                const node = last(this.stack)!
                if (node.characters) node.characters += processed
                else node.characters = processed
            }

            cDataNode(str: string): void {
                const node = last(this.stack)!
                if (node.characters) node.characters += str
                else node.characters = str
            }

            endElement(): void {
                this.stack.pop()
            }

            endDocument(): XmlElementStruct {
                return last(this.stack)!
            }
        }

        function name(
            localPart: string,
            prefix: string | null = null,
            namespaceUri: Uri | null = null
        ): QName {
            return {
                prefix,
                localPart,
                namespaceUri,
                qName: prefix ? `${prefix}:${localPart}` : localPart,
            }
        }

        it('parses a basic xml document', () => {
            // language=XML
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <body>
                <p foo="bar">This is a test</p>
                <p foo="baz">Of the xml parsing</p>
                <p>System</p>
            </body>
            `

            const r = parseXml(xml, new TestContentHandler())
            expect(r).toEqual({
                ...xmlElement,
                name: name('#document'),
                characters: any(String),
                children: [
                    {
                        ...xmlElement,
                        name: name('body'),
                        characters: any(String),
                        children: [
                            {
                                ...xmlElement,
                                name: name('p'),
                                attributes: {
                                    foo: {
                                        name: name('foo'),
                                        value: 'bar',
                                    },
                                },
                                characters: 'This is a test',
                            },
                            {
                                ...xmlElement,
                                name: name('p'),
                                attributes: {
                                    foo: {
                                        name: name('foo'),
                                        value: 'baz',
                                    },
                                },
                                characters: 'Of the xml parsing',
                            },
                            {
                                ...xmlElement,
                                name: name('p'),
                                characters: 'System',
                            },
                        ],
                    },
                ],
            })
        })

        it('throws an error on an unexpected element close', () => {
            const xml = `<a><b></c></b></a>`
            expect(() => parseXml(xml, mockHandler)).toThrowMatching((e) => {
                return e instanceof StringParseError && e.position === 9
            })
        })

        it('provides CDATA content as characters', () => {
            const expected = `  Unprocessed &amp; < characters > `
            // language=XML
            const xml = `
                <main><![CDATA[${expected}]]></main>`
            const r = parseXml(xml, new TestContentHandler())
            expect(x(r, 'main').characters).toEqual(expected)
        })

        it('does not allow duplicate attributes', () => {
            // noinspection HtmlUnknownAttribute
            const xml = `<main a="1" a="2"></main>`
            expect(() =>
                parseXml(xml, new TestContentHandler())
            ).toThrowMatching(
                (e) => e instanceof StringParseError && e.position === 17
            )
        })

        it('allows attributes with the same local name and different namespaces', () => {
            // language=XML
            const xml = `<main xmlns:pre1="ns1" xmlns:pre2="ns2">
                <a pre2:a="1" pre1:a="2"/></main>`
            const o = parseXml(xml, new TestContentHandler())
            expect(x(o, 'main.a').attributes!['pre1:a']!.name).toEqual(
                name('a', 'pre1', 'ns1')
            )
            expect(x(o, 'main.a').attributes!['pre2:a']!.name).toEqual(
                name('a', 'pre2', 'ns2')
            )
        })

        it('ignores declarations', () => {
            // language=XML
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN"
                    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">
            <html><?decl ?>Chars</html>`
            const r = parseXml(xml, new TestContentHandler())
            expect(r).toEqual({
                ...xmlElement,
                name: name('#document'),
                characters: any(String),
                children: [
                    {
                        ...xmlElement,
                        name: name('html'),
                        characters: 'Chars',
                    },
                ],
            })
        })

        it('ignores comments', () => {
            // language=XML
            const xml = `<!-- <!- >; Comment --><html><!-- Comment &lt>;< -->Chars</html><!-- > Comment -->`
            const r = parseXml(xml, new TestContentHandler())
            expect(r).toEqual({
                ...xmlElement,
                name: name('#document'),
                children: [
                    {
                        ...xmlElement,
                        name: name('html'),
                        characters: 'Chars',
                    },
                ],
            })
        })

        it('applies a namespace to prefixed attributes', () => {
            // language=XML
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <document xmlns='https://example.com' ns1:foo="bar" xmlns:ns1="ns1-uri"
                      xmlns:ns2="ns2-uri">
                <body ns2:a="va" ns1:b="vb"/>
            </document>
            `
            const r = parseXml(xml, new TestContentHandler())
            expect(x(r, 'document').attributes!['ns1:foo']!.name).toEqual(
                name('foo', 'ns1', 'ns1-uri')
            )
            expect(x(r, 'document.body').attributes!['ns2:a']!.name).toEqual(
                name('a', 'ns2', 'ns2-uri')
            )
            expect(x(r, 'document.body').attributes!['ns1:b']!.name).toEqual(
                name('b', 'ns1', 'ns1-uri')
            )
        })

        it('does not apply default namespace to unprefixed attributes', () => {
            // https://www.w3.org/TR/REC-xml-names/#defaulting
            // Default namespace declarations do not apply directly to attribute names; the
            // interpretation of unprefixed attributes is determined by the element on which they
            // appear.

            // language=XML
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <document xmlns='https://example.com' foo="bar">
                <body a="b"/>
            </document>
            `
            const r = parseXml(xml, new TestContentHandler())
            expect(x(r, 'document').attributes!.foo!.name).toEqual(name('foo'))
            expect(x(r, 'document.body').attributes!.a!.name).toEqual(name('a'))
        })

        describe('when xmlns is an empty string', () => {
            it('provides a null namespaceUri', () => {
                // language=XML
                const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <document xmlns='https://example.com' foo="bar" pre1:bar="test" xmlns:pre1="">
                    <body a="b" xmlns=""/>
                </document>
                `
                const r = parseXml(xml, new TestContentHandler())
                expect(
                    x(r, 'document').attributes!['pre1:bar']!.name.namespaceUri
                ).toBeNull()
                expect(x(r, 'document.body').name.namespaceUri).toBeNull()
            })
        })

        it('applies a namespace to prefixed elements', () => {
            // language=XML
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <document xmlns='https://example.com' xmlns:ns1="ns1-uri" xmlns:ns2="ns2-uri">
                <ns1:body/>
                <ns2:body>
                    <ns1:p>A</ns1:p>
                    <ns2:p>B</ns2:p>
                    <ns2:p>C</ns2:p>
                </ns2:body>
            </document>
            `
            const r = parseXml(xml, new TestContentHandler())
            expect(x(r, 'document.ns1:body').name).toEqual(
                name('body', 'ns1', 'ns1-uri')
            )
            expect(x(r, 'document.ns2:body').name).toEqual(
                name('body', 'ns2', 'ns2-uri')
            )
            expect(x(r, 'document.ns2:body.ns1:p').name).toEqual(
                name('p', 'ns1', 'ns1-uri')
            )
            expect(x(r, 'document.ns2:body.ns2:p[0]').name).toEqual(
                name('p', 'ns2', 'ns2-uri')
            )
            expect(x(r, 'document.ns2:body.ns2:p[1]').name).toEqual(
                name('p', 'ns2', 'ns2-uri')
            )
        })

        it('applies a default namespace to unprefixed elements', () => {
            // language=XML
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <document>
                <body xmlns='ns1-uri'>
                    <div>
                        <p xmlns="ns2-uri">
                            <a>a</a>
                        </p>
                        <p>
                            <a>b</a>
                        </p>
                    </div>
                </body>
            </document>
            `
            const r = parseXml(xml, new TestContentHandler())
            expect(x(r, 'document.body').name).toEqual(
                name('body', null, 'ns1-uri')
            )
            expect(x(r, 'document.body.div').name).toEqual(
                name('div', null, 'ns1-uri')
            )
            expect(x(r, 'document.body.div.p').name).toEqual(
                name('p', null, 'ns2-uri')
            )
            expect(x(r, 'document.body.div.p.a').name).toEqual(
                name('a', null, 'ns2-uri')
            )
            expect(x(r, 'document.body.div.p[1]').name).toEqual(
                name('p', null, 'ns1-uri')
            )
            expect(x(r, 'document.body.div.p[1].a').name).toEqual(
                name('a', null, 'ns1-uri')
            )
        })

        describe('when a namespace prefix cannot resolve', () => {
            it('provides null as namespaceUri', () => {
                // language=XML
                const xml = `
            <root>
                <foo:bar>
                </foo:bar>
            </root>
            `
                const r = parseXml(xml, new TestContentHandler())
                expect(x(r, 'root.foo:bar').name).toEqual(
                    name('bar', 'foo', null)
                )
            })
        })

        describe('when handlers throw errors', () => {
            it('rethrows StringParseError for startDocument handler', () => {
                expect(() => {
                    parseXml('<xml>test</xml>', {
                        ...mockHandler,
                        startDocument(): void {
                            throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 0 &&
                        e.reason === 'test'
                    )
                })
            })
            it('rethrows StringParseError for endDocument handler', () => {
                expect(() => {
                    parseXml('<xml>test</xml>', {
                        ...mockHandler,
                        endDocument(): never {
                            throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 15 &&
                        e.reason === 'test'
                    )
                })
            })
            it('rethrows StringParseError for startElement handler', () => {
                expect(() => {
                    parseXml('<xml>test<a></a></xml>', {
                        ...mockHandler,
                        startElement(name: QName): void {
                            if (name.qName === 'a') throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 11 &&
                        e.reason === 'test'
                    )
                })
                expect(() => {
                    parseXml('<xml>test<a/></xml>', {
                        ...mockHandler,
                        startElement(name: QName): void {
                            if (name.qName === 'a') throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 11 &&
                        e.reason === 'test'
                    )
                })
            })
            it('rethrows StringParseError for textNode handler', () => {
                expect(() => {
                    parseXml('<xml>test</xml>', {
                        ...mockHandler,
                        textNode(): void {
                            throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 9 &&
                        e.reason === 'test'
                    )
                })
            })

            it('rethrows StringParseError for cData handler', () => {
                expect(() => {
                    // language=XML
                    const xml = '<xml><![CDATA[test]]></xml>'
                    parseXml(xml, {
                        ...mockHandler,
                        cDataNode(): void {
                            throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 18 &&
                        e.reason === 'test'
                    )
                })
            })

            it('rethrows StringParseError for endElement handler', () => {
                expect(() => {
                    parseXml('<xml>test</xml>', {
                        ...mockHandler,
                        endElement(): void {
                            throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 15 &&
                        e.reason === 'test'
                    )
                })
                expect(() => {
                    parseXml('<xml>test<a/></xml>', {
                        ...mockHandler,
                        endElement(): void {
                            throw new Error('test')
                        },
                    })
                }).toThrowMatching((e) => {
                    return (
                        e instanceof StringParseError &&
                        e.position === 13 &&
                        e.reason === 'test'
                    )
                })
            })
        })
    })

    const isParseError = (e: any) => e instanceof StringParseError
})
