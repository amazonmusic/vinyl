/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    attrBoolean,
    attrDateTime,
    attrFloat,
    attrInt,
    attrString,
    charactersString,
    element,
    elements,
    parseXml,
    parseXmlHandler,
    type ParseXmlHandlerOptions,
    qName,
    type XmlElement,
    XmlElementImpl,
    type XmlRules,
    XmlSchemaError,
} from '@amazon/vinyl-xml'
import {
    type AnyRecord,
    IllegalStateError,
    type ReadonlyDate,
    StringParseError,
} from '@amazon/vinyl-util'
import objectContaining = jasmine.objectContaining

/**
 * A helper type definition after which to model hierarchical rules.
 */
interface DocType extends XmlElement<DocType> {
    readonly doc: DocElementType
}

interface DocElementType extends XmlElement<DocElementType> {
    readonly parent: DocType
    readonly body: BodyElementType
}

interface BodyElementType extends XmlElement<BodyElementType> {
    readonly parent: DocElementType
    readonly p: readonly PElementType[]
}

interface PElementType extends XmlElement<PElementType> {
    readonly parent: BodyElementType
    readonly text: string
}

const pElementType: XmlRules<PElementType> = {
    text: charactersString,
}

describe('ParseXmlHandlerImpl', () => {
    const docRules: XmlRules<DocType> = {
        doc: element(
            {
                body: element(
                    {
                        p: elements(pElementType, { minOccurs: 1 }),
                    },
                    { required: true }
                ),
            },
            { required: true }
        ),
    }

    it('adds a property for a matching element rule', () => {
        interface T {
            doc: {
                foo?: AnyRecord
                bar?: AnyRecord
            }
        }

        const contentHandler = parseXmlHandler<T>({
            doc: element(
                {
                    foo: element({}),
                    bar: element({}),
                },
                { required: true }
            ),
        })
        {
            contentHandler.startDocument()
            contentHandler.startElement(qName('doc'), {})
            contentHandler.startElement(qName('foo'), {})
            contentHandler.endElement()
            contentHandler.endElement()
            const v = contentHandler.endDocument()
            expect(v.toJSON()).toEqual({
                doc: {
                    foo: {},
                },
            })
        }
        {
            contentHandler.startDocument()
            contentHandler.startElement(qName('doc'), {})
            contentHandler.startElement(qName('bar'), {})
            contentHandler.endElement()
            contentHandler.endElement()
            const v = contentHandler.endDocument()
            expect(v.toJSON()).toEqual({
                doc: {
                    bar: {},
                },
            })
        }
    })

    describe('when handling attribute rules', () => {
        it('applies properties to the element with matching attribute rules', () => {
            const contentHandler = parseXmlHandler<{
                foo: { bar?: number; baz?: string }
            }>({
                foo: element(
                    {
                        bar: attrInt(),
                        baz: attrString(),
                    },
                    { required: true }
                ),
            })
            {
                contentHandler.startDocument()
                contentHandler.startElement(qName('foo'), {
                    bar: {
                        name: qName('bar'),
                        value: '3',
                    },
                    baz: {
                        name: qName('baz'),
                        value: 'bazValue',
                    },
                })
                contentHandler.endElement()
                const v = contentHandler.endDocument()
                expect(v.toJSON()).toEqual({
                    foo: {
                        bar: 3,
                        baz: 'bazValue',
                    },
                })
            }
        })

        describe('when attribute has default values', () => {
            it('uses default value when attribute is missing', () => {
                const contentHandler = parseXmlHandler<{
                    foo: { withDefault: number }
                }>({
                    foo: element(
                        {
                            withDefault: attrInt({ default: 1 }),
                        },
                        { required: true }
                    ),
                })
                {
                    contentHandler.startDocument()
                    contentHandler.startElement(qName('foo'), {})
                    contentHandler.endElement()
                    const v = contentHandler.endDocument()
                    expect(v.toJSON()).toEqual({
                        foo: {
                            withDefault: 1,
                        },
                    })
                }
                {
                    contentHandler.startDocument()
                    contentHandler.startElement(qName('foo'), {
                        withDefault: {
                            name: qName('withDefault'),
                            value: '2',
                        },
                    })
                    contentHandler.endElement()
                    const v = contentHandler.endDocument()
                    expect(v.toJSON()).toEqual({
                        foo: {
                            withDefault: 2,
                        },
                    })
                }
            })
        })

        it('applies attribute rules with matching namespace rules', () => {
            const contentHandler = parseXmlHandler<{
                foo: {
                    bar_ns1?: number
                    bar_ns2?: number
                    baz?: string
                }
            }>({
                foo: element(
                    {
                        bar_ns1: attrInt({
                            localPart: 'bar',
                            namespaceUri: 'ns1',
                        }),
                        bar_ns2: attrInt({
                            localPart: 'bar',
                            namespaceUri: 'ns2',
                        }),
                        baz: attrString({
                            namespaceUri: null,
                        }),
                    },
                    { required: true }
                ),
            })
            contentHandler.startDocument()
            contentHandler.startElement(qName('foo'), {
                'pre:bar': {
                    name: qName('bar', 'pre', 'ns1'),
                    value: '3',
                },
                'pre2:bar': {
                    name: qName('bar', 'pre2', 'ns2'),
                    value: '4',
                },
                baz: {
                    name: qName('baz'),
                    value: 'test',
                },
            })
            contentHandler.endElement()
            const v = contentHandler.endDocument()
            expect(v.toJSON()).toEqual({
                foo: {
                    bar_ns1: 3,
                    bar_ns2: 4,
                    baz: 'test',
                },
            })
        })

        it('throws an error if a required attribute is not found', () => {
            const rules: XmlRules<{
                doc: {
                    body: {
                        a: boolean
                    }
                }
            }> = {
                doc: element(
                    {
                        body: element(
                            {
                                a: attrBoolean({ required: true }),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            }
            expect(() =>
                parseXmlFromRules(
                    `
                <doc>
                    <body/>
                </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)
            expect(() =>
                parseXmlFromRules(
                    `
                <doc>
                    <body/>
                </doc>`,
                    rules,
                    { validateRules: false }
                )
            ).not.toThrow()
            expect(
                parseXmlFromRules(
                    `
                <doc>
                    <body a="false"/>
                </doc>`,
                    rules
                ).toJSON()
            ).toEqual({
                doc: {
                    body: {
                        a: false,
                    },
                },
            })
        })

        it('ignores unknown attributes without a rule', () => {
            const rules: XmlRules<{
                doc: {
                    a: string | undefined
                }
            }> = {
                doc: element(
                    {
                        a: attrString(),
                    },
                    { required: true }
                ),
            }
            expect(
                parseXmlFromRules(
                    `<doc a="found" b="unknown"/>`,
                    rules
                ).toJSON()
            ).toEqual({
                doc: { a: 'found' },
            })
        })
    })

    describe('when handling element rules', () => {
        it('matches namespaced elements with matching rule', () => {
            const contentHandler = parseXmlHandler<{
                foo_ns1: AnyRecord
                foo_ns2: AnyRecord
            }>({
                foo_ns1: element(
                    {},
                    {
                        required: true,
                        localPart: 'foo',
                        namespaceUri: 'ns1',
                    }
                ),
                foo_ns2: element(
                    {},
                    {
                        required: true,
                        localPart: 'foo',
                        namespaceUri: 'ns2',
                    }
                ),
            })

            contentHandler.startDocument()
            const n = qName('p')
            contentHandler.startElement(n, {})
            contentHandler.endElement()
            contentHandler.startElement(qName('foo', '', 'ns1'), {})
            contentHandler.endElement()
            contentHandler.startElement(qName('foo', '', 'ns2'), {})
            contentHandler.endElement()
            const v = contentHandler.endDocument()
            expect(v.toJSON()).toEqual({
                foo_ns1: {},
                foo_ns2: {},
            })
        })

        it('throws an error if a required element is missing', () => {
            const contentHandler = parseXmlHandler({
                doc: element({}, { required: true }),
            })
            contentHandler.startDocument()
            expect(() => contentHandler.endDocument()).toThrowMatching(
                (e) => e instanceof XmlSchemaError
            )
        })

        it('throws a ParseError if more than one element matches the rule', () => {
            expect(() => {
                parseXmlFromRules<any>(
                    `
                <doc>
                    <body/>
                    <body/>
                </doc>`,
                    {
                        doc: element({ body: element({}) }),
                    }
                )
            }).toThrowMatching((e) => e instanceof StringParseError)
        })

        it('allows localPart overrides', () => {
            interface T {
                foo?: AnyRecord
                bar?: AnyRecord
            }

            const contentHandler = parseXmlHandler<T>({
                foo: element({}, { localPart: 'foo_override' }),
                bar: element({}),
            })
            contentHandler.startDocument()
            contentHandler.startElement(qName('foo_override'), {})
            contentHandler.endElement()
            const v = contentHandler.endDocument()
            expect(v.toJSON()).toEqual({
                foo: {},
            })
        })
    })

    describe('when handling character rules', () => {
        describe('when there is a character handler', () => {
            it('concatenates trimmed, decoded textNode strings', () => {
                const contentHandler = parseXmlHandler({
                    doc: element({
                        chars: charactersString,
                    }),
                })
                contentHandler.startDocument()
                contentHandler.startElement(qName('doc'), {})
                contentHandler.textNode('  \tA &amp; B  ')
                contentHandler.textNode(' &lt; C ')
                contentHandler.endElement()
                const v = contentHandler.endDocument()
                expect(v.toJSON()).toEqual({
                    doc: {
                        chars: 'A & B< C',
                    },
                })
            })

            it('concatenates unprocessed cDataNode strings', () => {
                const contentHandler = parseXmlHandler({
                    doc: element({
                        chars: charactersString,
                    }),
                })
                contentHandler.startDocument()
                contentHandler.startElement(qName('doc'), {})
                contentHandler.cDataNode('\t&amp;\n')
                contentHandler.cDataNode('&gt;\t')
                contentHandler.endElement()
                const v = contentHandler.endDocument()
                expect(v.toJSON()).toEqual({
                    doc: {
                        chars: '\t&amp;\n&gt;\t',
                    },
                })
            })
        })

        describe('when there is not a character handler', () => {
            it('does not process text or CDATA nodes', () => {
                const contentHandler = parseXmlHandler({
                    doc: element({}),
                })
                contentHandler.startDocument()
                contentHandler.startElement(qName('doc'), {})
                contentHandler.cDataNode('\t&amp;\n')
                contentHandler.cDataNode('&gt;\t')
                contentHandler.textNode('a test')
                contentHandler.endElement()
                const v = contentHandler.endDocument()
                expect(v.toJSON()).toEqual({
                    doc: {},
                })
            })
        })
    })

    describe('when handling elements rules', () => {
        it(
            'creates an empty array when elements handler sets useEmptyArrays to true and no' +
                ' matching elements existed',
            () => {
                const contentHandler = parseXmlHandler({
                    doc: element(
                        {
                            p: elements({}, { useEmptyArrays: true }),
                        },
                        { required: true }
                    ),
                })
                const r = parseXml(
                    `
                <doc>
                </doc>`,
                    contentHandler
                )
                expect(r.toJSON()).toEqual({
                    doc: {
                        p: [],
                    },
                })
            }
        )

        it('creates an array of matched elements when useEmptyArrays is true', () => {
            const r = parseXmlFromRules(
                `
                <doc>
                    <body>
                        <p></p>
                        <p></p>
                        <p></p>
                        <p></p>
                    </body>
                </doc>`,
                {
                    doc: element(
                        {
                            body: element(
                                {
                                    p: elements({}, { useEmptyArrays: true }),
                                },
                                { required: true }
                            ),
                        },
                        { required: true }
                    ),
                }
            )
            expect(r.toJSON()).toEqual({
                doc: {
                    body: {
                        p: [{}, {}, {}, {}],
                    },
                },
            })
        })

        it('does not throw an error if number of elements is at least minOccurs and at most maxOccurs', () => {
            const rules: XmlRules<DocType> = {
                doc: element(
                    {
                        body: element(
                            {
                                p: elements(pElementType, {
                                    minOccurs: 2,
                                    maxOccurs: 4,
                                }),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            }
            expect(
                parseXmlFromRules(
                    `
                <doc>
                    <body>
                        <p></p>
                        <p></p>
                        <p></p>
                        <p></p>
                    </body>
                </doc>`,
                    rules
                ).toJSON()
            ).toEqual(
                objectContaining({
                    doc: {
                        body: {
                            p: [
                                {
                                    text: '',
                                },
                                {
                                    text: '',
                                },
                                {
                                    text: '',
                                },
                                {
                                    text: '',
                                },
                            ],
                        },
                    },
                })
            )
            expect(
                parseXmlFromRules(
                    `
                <doc>
                    <body>
                        <p></p>
                        <p></p>
                    </body>
                </doc>`,
                    rules
                ).toJSON()
            ).toEqual(
                objectContaining({
                    doc: {
                        body: {
                            p: [
                                {
                                    text: '',
                                },
                                {
                                    text: '',
                                },
                            ],
                        },
                    },
                })
            )
        })

        it('throws an error if the number of elements is less than minOccurs', () => {
            const rules: XmlRules<DocType> = {
                doc: element(
                    {
                        body: element(
                            {
                                p: elements(pElementType, { minOccurs: 2 }),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            }
            expect(() =>
                parseXmlFromRules(
                    `
                <doc>
                    <body>
                        <p></p>
                    </body>
                </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)
            expect(() =>
                parseXmlFromRules(
                    `
                <doc>
                    <body>
                    </body>
                </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)

            expect(() =>
                parseXmlFromRules(
                    `
                <doc>
                    <body>
                    </body>
                </doc>`,
                    rules,
                    {
                        validateRules: false,
                    }
                )
            ).not.toThrowError()
        })

        it('throws an error if the number of elements is more than maxOccurs', () => {
            const rules: XmlRules<DocType> = {
                doc: element(
                    {
                        body: element(
                            {
                                p: elements(pElementType, {
                                    maxOccurs: 3,
                                    useEmptyArrays: true,
                                }),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            }
            expect(() =>
                parseXmlFromRules<DocType>(
                    `
                <doc>
                    <body>
                        <p></p>
                        <p></p>
                        <p></p>
                        <p></p>
                    </body>
                </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)
            expect(() =>
                parseXmlFromRules(
                    `
                <doc>
                    <body>
                        <p></p>
                        <p></p>
                        <p></p>
                        <p></p>
                    </body>
                </doc>`,
                    rules,
                    {
                        validateRules: false,
                    }
                )
            ).not.toThrowError()
            expect(() =>
                parseXmlFromRules<DocType>(
                    `
                <doc>
                    <body>
                        <p></p>
                        <p></p>
                        <p></p>
                        <p></p>
                        <p></p>
                    </body>
                </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)
        })

        it('throws an error if the number of elements is less than minOccurs', () => {
            const rules: XmlRules<DocType> = {
                doc: element(
                    {
                        body: element(
                            {
                                p: elements<PElementType>(
                                    {
                                        text: charactersString,
                                    },
                                    { minOccurs: 2 }
                                ),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            }
            expect(() =>
                parseXmlFromRules<DocType>(
                    `
            <doc>
                <body>
                    <p></p>
                </body>
            </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)
            expect(() =>
                parseXmlFromRules<DocType>(
                    `
            <doc>
                <body>
                </body>
            </doc>`,
                    rules
                )
            ).toThrowMatching((e) => e instanceof StringParseError)
            expect(() =>
                parseXmlFromRules(
                    `
            <doc>
                <body>
                    <p></p>
                </body>
            </doc>`,
                    rules,
                    {
                        validateRules: false,
                    }
                )
            ).not.toThrowError()
        })

        it('elements have parent references', () => {
            const html = parseXmlFromRules(
                `<doc><body><p/><p/></body></doc>`,
                docRules
            )
            expect(html.doc.parent).toBe(html)
            expect(html.doc.body.parent).toBe(html.doc)
            expect(html.doc.body.p[0].parent).toBe(html.doc.body)
            expect(html.doc.body.p[1].parent).toBe(html.doc.body)
        })

        it('elements can be cloned', () => {
            const html = parseXmlFromRules(
                `<doc><body><p>Hello</p><p>World</p></body></doc>`,
                docRules
            )

            const clonedBody = html.doc.body.clone()
            expect(clonedBody.toJSON()).toEqual(
                objectContaining({
                    p: [
                        {
                            text: 'Hello',
                        },
                        {
                            text: 'World',
                        },
                    ],
                })
            )
            expect(clonedBody.parent).toBe(html.doc)
            expect(clonedBody.p[0].parent).toBe(clonedBody)
            expect(clonedBody.p[1].parent).toBe(clonedBody)

            const clone = html.clone()
            expect(clone.toJSON()).toEqual(
                objectContaining({
                    doc: {
                        body: {
                            p: [
                                {
                                    text: 'Hello',
                                },
                                {
                                    text: 'World',
                                },
                            ],
                        },
                    },
                })
            )
            expect(clone.doc.parent).toBe(clone)
            expect(clone.doc.body.parent).toBe(clone.doc)
            expect(clone.doc.body.p[0].parent).toBe(clone.doc.body)
            expect(clone.doc.body.p[1].parent).toBe(clone.doc.body)
        })
    }) // element rules

    it('does not allow startDocument before within start/end pair', () => {
        const contentHandler = parseXmlHandler({})
        contentHandler.startDocument()
        expect(() => contentHandler.startDocument()).toThrowMatching(
            (e) => e instanceof IllegalStateError
        )
    })

    describe('xmlHandler', () => {
        it('creates a content handler for the specified parse rules', () => {
            interface SimpleExample2 extends XmlElement<SimpleExample2> {
                readonly doc: {
                    readonly a: ReadonlyDate
                    readonly b: {
                        readonly c: number
                    }
                }
            }

            const handler = parseXmlHandler<SimpleExample2>({
                doc: element(
                    {
                        a: attrDateTime({ required: true }),
                        b: element(
                            {
                                c: attrFloat({ required: true }),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            })

            // language=XML
            const o = parseXml<SimpleExample2>(
                `
                    <doc a="2023-03-14T13:53:00.861Z">
                        <b c="123.3"/>
                    </doc>
                `,
                handler
            )
            expect(o.toJSON()).toEqual({
                doc: {
                    a: '2023-03-14T13:53:00.861Z',
                    b: {
                        c: 123.3,
                    },
                },
            })
        })
    })
})

describe('XmlElementImpl', () => {
    it('supports indexed access', () => {
        const e = new XmlElementImpl()
        e.a = 1
        e.b = 'b'
        expect(e).toEqual(
            objectContaining({
                a: 1,
                b: 'b',
            })
        )
    })

    it('supports enumerated keys', () => {
        const e = new XmlElementImpl()
        e.a = 1
        e.b = 'b'
        expect(Object.keys(e)).toEqual(['a', 'b'])
    })
})

/**
 * Parses an XML string into a statically typed object based on the given rule set.
 *
 * @param xml The XML string to parse.
 * @param rules The handler for deserialization.
 * @param options Optional content handler parameters.
 * @see parseXml
 */
function parseXmlFromRules<T extends object>(
    xml: string,
    rules: XmlRules<T>,
    options?: Partial<ParseXmlHandlerOptions>
): T & XmlElement<T> {
    return parseXml(xml, parseXmlHandler(rules, options))
}
