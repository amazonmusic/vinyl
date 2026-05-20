/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRecord, ReadonlyDate } from '@amazon/vinyl-util'
import {
    attrBoolean,
    attrDateTime,
    attrInt,
    attrString,
    charactersString,
    element,
    elements,
    mapXmlRules,
    stringifyXml,
} from '@amazon/vinyl-xml'

describe('stringifyXml', () => {
    it('serializes attributes', () => {
        interface DocType {
            doc: {
                a?: number
                b?: number
                c?: string
            }
        }

        const xml = stringifyXml<DocType>(
            {
                doc: {
                    a: 3,
                    b: 2,
                    c: 'cValue',
                },
            },
            mapXmlRules({
                doc: element(
                    {
                        a: attrInt,
                        b: attrInt,
                        c: attrString,
                    },
                    { required: true }
                ),
            })
        )
        // language=xml
        expect(xml).toBe(`<?xml version="1.0"?>
<doc a="3" b="2" c="cValue"/>`)
    })

    describe('when attribute equals its default', () => {
        it('skips the attribute', () => {
            interface DocType {
                doc: {
                    a?: number
                    withDefault: number
                }
            }

            const xml = stringifyXml<DocType>(
                {
                    doc: {
                        a: 2,
                        withDefault: 3,
                    },
                },
                mapXmlRules({
                    doc: element(
                        {
                            a: attrInt,
                            withDefault: attrInt({ default: 3 }),
                        },
                        { required: true }
                    ),
                })
            )
            // language=xml
            expect(xml).toBe(`<?xml version="1.0"?>
<doc a="2"/>`)
        })
    })

    describe('when attribute is required', () => {
        describe('and attribute is missing', () => {
            it('throws an XmlSchemaError', () => {
                interface DocType {
                    doc: {
                        requiredAttr: number
                    }
                }

                const rules = mapXmlRules<DocType>({
                    doc: element(
                        {
                            requiredAttr: attrInt({ required: true }),
                        },
                        { required: true }
                    ),
                })

                expect(() =>
                    stringifyXml<DocType>(
                        {
                            // @ts-expect-error Expected requiredAttr to be set
                            doc: {},
                        },
                        rules
                    )
                ).toThrowError(`Attribute 'requiredAttr' is required`)
            })
        })

        describe('and attribute value is undefined', () => {
            it('throws an XmlSchemaError', () => {
                const rules = mapXmlRules({
                    root: element({
                        foo: attrInt({ required: true }),
                    }),
                })

                expect(() =>
                    stringifyXml(
                        {
                            root: {},
                        },
                        rules
                    )
                ).toThrowError(`Attribute 'foo' is required`)

                expect(() =>
                    stringifyXml(
                        {
                            root: {
                                foo: undefined,
                            },
                        },
                        rules
                    )
                ).toThrowError(`Attribute 'foo' is required`)
            })
        })
    })

    describe('when attribute is not required', () => {
        describe('and value is undefined', () => {
            it('does not serialize the value', () => {
                const rules = mapXmlRules({
                    root: element({
                        foo: attrInt(),
                    }),
                })

                expect(
                    stringifyXml(
                        {
                            root: {
                                foo: undefined,
                            },
                        },
                        rules
                    )
                ).toEqual(`<?xml version="1.0"?>\n<root/>`)
            })
        })
    })

    it('serializes children in order', () => {
        interface DocType {
            doc: {
                a?: number
                foo: {
                    a: number
                    b: number
                }
                bar: {
                    a: boolean
                    b: string
                }
                baz: {
                    a: ReadonlyDate
                    b: number
                }
            }
        }

        const xml = stringifyXml<DocType>(
            {
                doc: {
                    a: 3,
                    foo: {
                        a: 1,
                        b: 2,
                    },
                    bar: {
                        a: true,
                        b: 'test',
                    },
                    baz: {
                        a: new Date(123),
                        b: 3,
                    },
                },
            },
            mapXmlRules({
                doc: element(
                    {
                        a: attrInt,
                        foo: element(
                            {
                                a: attrInt({ required: true }),
                                b: attrInt({ required: true }),
                            },
                            { required: true }
                        ),
                        bar: element(
                            {
                                a: attrBoolean({ required: true }),
                                b: attrString({ required: true }),
                            },
                            { required: true }
                        ),
                        baz: element(
                            {
                                a: attrDateTime({ required: true }),
                                b: attrInt({ required: true }),
                            },
                            { required: true }
                        ),
                    },
                    { required: true }
                ),
            })
        )
        // language=xml
        expect(xml).toBe(`<?xml version="1.0"?>
<doc a="3">
    <foo a="1" b="2"/>
    <bar a="true" b="test"/>
    <baz a="1970-01-01T00:00:00.123Z" b="3"/>
</doc>`)
    })

    it('accepts indent and newline overrides', () => {
        interface DocType {
            doc: {
                a?: number
                foo: AnyRecord
                bar: {
                    baz: AnyRecord
                }
            }
        }

        const object: DocType = {
            doc: {
                a: 3,
                foo: {},
                bar: {
                    baz: {},
                },
            },
        }
        const rules = mapXmlRules<DocType>({
            doc: element(
                {
                    a: attrInt,
                    foo: element({}, { required: true }),
                    bar: element(
                        {
                            baz: element({}, { required: true }),
                        },
                        { required: true }
                    ),
                },
                { required: true }
            ),
        })
        const xml = stringifyXml<DocType>(object, rules, {
            indent: '-',
            newline: '+',
        })
        expect(xml).toBe(
            `<?xml version="1.0"?>+<doc a="3">+-<foo/>+-<bar>+--<baz/>+-</bar>+</doc>`
        )
    })

    it('serializes characters as CDATA nodes', () => {
        interface DocType {
            doc: {
                chars: string
            }
        }

        const object: DocType = {
            doc: {
                chars: '<This is > a Set of Characters>&lt;',
            },
        }
        const rules = mapXmlRules<DocType>({
            doc: element(
                {
                    chars: charactersString,
                },
                { required: true }
            ),
        })
        const xml = stringifyXml<DocType>(object, rules, {
            indent: '',
            newline: '',
        })
        expect(xml).toBe(
            // language=XML
            `<?xml version="1.0"?><doc><![CDATA[<This is > a Set of Characters>&lt;]]></doc>`
        )
    })

    describe('when options.includeXmlDeclaration is false', () => {
        it('does not include the xml declaration', () => {
            expect(
                stringifyXml(
                    {
                        root: {},
                    },
                    mapXmlRules({ root: element({}) }),
                    { includeXmlDeclaration: false }
                )
            ).toBe(`<root/>`)
        })
    })

    describe('when the default namespace is null', () => {
        describe('and a node has a non-null namespace', () => {
            it('sets the default namespace', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                a: 3,
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    a: attrInt({ required: true }),
                                },
                                { namespaceUri: 'example' }
                            ),
                        })
                    )
                ).toBe(`<?xml version="1.0"?>
<root xmlns="example" a="3"/>`)

                expect(
                    stringifyXml(
                        {
                            root: {
                                a: {},
                                b: {},
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    a: element(
                                        {},
                                        {
                                            required: true,
                                            namespaceUri: 'ns1',
                                        }
                                    ),
                                    b: element(
                                        {},
                                        {
                                            required: true,
                                            namespaceUri: 'ns2',
                                            localPart: 'a',
                                        }
                                    ),
                                },
                                { required: true }
                            ),
                        }),
                        {
                            includeXmlDeclaration: false,
                        }
                    )
                ).toBe(
                    `<root>
    <a xmlns="ns1"/>
    <a xmlns="ns2"/>
</root>`
                )
            })
        })

        describe('and a node has a null namespace', () => {
            it('does not set the default namespace', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                child: [{}, {}, {}],
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    child: elements(
                                        {},
                                        {
                                            namespaceUri: null,
                                            useEmptyArrays: true,
                                        }
                                    ),
                                },
                                { namespaceUri: null }
                            ),
                        }),
                        { includeXmlDeclaration: false }
                    )
                ).toBe(`<root>
    <child/>
    <child/>
    <child/>
</root>`)
            })
        })
    })

    describe('when the default namespace is non null', () => {
        describe('and an element has a null namespace', () => {
            it('sets the default namespace to null', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                child: [{}, {}, {}],
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    child: elements(
                                        {},
                                        {
                                            namespaceUri: null,
                                            useEmptyArrays: true,
                                        }
                                    ),
                                },
                                { namespaceUri: 'example' }
                            ),
                        }),
                        { includeXmlDeclaration: false }
                    )
                ).toBe(`<root xmlns="example">
    <child xmlns=""/>
    <child xmlns=""/>
    <child xmlns=""/>
</root>`)
            })
        })

        describe('and an element has different namespace', () => {
            it('prefixes the element name', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                a: {
                                    attr1: 3,
                                    element1: {},
                                    element2: {},
                                },
                                b: {},
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    a: element(
                                        {
                                            attr1: attrInt({ required: true }),
                                            element1: element(
                                                {},
                                                { required: true }
                                            ),
                                            element2: element(
                                                {},
                                                {
                                                    required: true,
                                                    namespaceUri: 'rootns',
                                                }
                                            ),
                                        },
                                        {
                                            required: true,
                                            namespaceUri: 'ns1',
                                        }
                                    ),
                                    b: element(
                                        {},
                                        {
                                            required: true,
                                            namespaceUri: 'ns2',
                                            localPart: 'a',
                                        }
                                    ),
                                },
                                { required: true, namespaceUri: 'rootns' }
                            ),
                        }),
                        {
                            includeXmlDeclaration: false,
                            prefixMap: new Map([
                                ['ns1', 'pre1'],
                                ['ns2', 'pre2'],
                            ]),
                        }
                    )
                ).toBe(
                    `<root xmlns="rootns" xmlns:pre1="ns1" xmlns:pre2="ns2">
    <pre1:a attr1="3">
        <pre1:element1/>
        <element2/>
    </pre1:a>
    <pre2:a/>
</root>`
                )

                expect(
                    stringifyXml(
                        {
                            root: {
                                a: {},
                                b: {},
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    a: element(
                                        {},
                                        {
                                            required: true,
                                            namespaceUri: 'ns1',
                                        }
                                    ),
                                    b: element(
                                        {},
                                        {
                                            required: true,
                                            namespaceUri: 'ns2',
                                            localPart: 'a',
                                        }
                                    ),
                                },
                                { required: true, namespaceUri: 'rootns' }
                            ),
                        }),
                        {
                            includeXmlDeclaration: false,
                        }
                    )
                ).toBe(
                    `<root xmlns="rootns" xmlns:ns_1="ns1" xmlns:ns_2="ns2">
    <ns_1:a/>
    <ns_2:a/>
</root>`
                )
            })
        })
    })

    describe('when an attribute has a namespace', () => {
        describe('and the namespace has a prefix mapped in the options', () => {
            it('uses the mapped prefix', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                a: 3,
                                b: 'bVal',
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    a: attrInt({
                                        required: true,
                                        namespaceUri: 'ns1',
                                    }),
                                    b: attrString({
                                        required: true,
                                        namespaceUri: 'ns2',
                                        localPart: 'a',
                                    }),
                                },
                                { required: true }
                            ),
                        }),
                        {
                            includeXmlDeclaration: false,
                            prefixMap: new Map([
                                ['ns1', 'foo'],
                                ['ns2', 'bar'],
                            ]),
                        }
                    )
                ).toBe(
                    '<root xmlns:foo="ns1" xmlns:bar="ns2" foo:a="3" bar:a="bVal"/>'
                )
            })
        })

        describe('and the namespace does not have a prefix mapped in the options', () => {
            it('generates a prefix', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                a: 3,
                                b: 'bVal',
                            },
                        },
                        mapXmlRules({
                            root: element(
                                {
                                    a: attrInt({
                                        required: true,
                                        namespaceUri: 'ns1',
                                    }),
                                    b: attrString({
                                        required: true,
                                        namespaceUri: 'ns2',
                                        localPart: 'a',
                                    }),
                                },
                                { required: true }
                            ),
                        }),
                        {
                            includeXmlDeclaration: false,
                        }
                    )
                ).toBe(
                    `<root xmlns:ns_1="ns1" xmlns:ns_2="ns2" ns_1:a="3" ns_2:a="bVal"/>`
                )
            })
        })
    })

    describe('when there is a characters rule', () => {
        describe('and no child elements', () => {
            it('writes the text on a single line', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                text: 'testchars',
                            },
                        },
                        mapXmlRules({
                            root: element({
                                text: charactersString,
                            }),
                        }),
                        { includeXmlDeclaration: false }
                    )
                ).toBe(`<root><![CDATA[testchars]]></root>`)
            })
        })

        describe('and child elements', () => {
            it('writes the text and then its children', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                text: 'testchars',
                                child: [{}, {}, {}],
                            },
                        },
                        mapXmlRules({
                            root: element({
                                text: charactersString,
                                child: elements({}, { useEmptyArrays: true }),
                            }),
                        }),
                        { includeXmlDeclaration: false }
                    )
                ).toBe(`<root>
    <![CDATA[testchars]]>
    <child/>
    <child/>
    <child/>
</root>`)
            })
        })

        describe('and empty stringified characters', () => {
            it('produces an empty element', () => {
                expect(
                    stringifyXml(
                        {
                            root: {
                                text: '',
                            },
                        },
                        mapXmlRules({
                            root: element({
                                text: charactersString,
                            }),
                        }),
                        { includeXmlDeclaration: false }
                    )
                ).toBe(`<root/>`)
            })
        })
    })

    describe('when a cyclic reference id detected', () => {
        it('throws an error', () => {
            const o = {
                get a() {
                    return o
                },
            }
            const rules = {
                a: () => element(rules),
            }
            expect(() => stringifyXml(o, mapXmlRules(rules))).toThrow()
        })
    })

    describe('when a required element is missing', () => {
        it('throws an XmlSchemaError', () => {
            expect(() =>
                stringifyXml(
                    {
                        root: {},
                    },
                    mapXmlRules({
                        root: element({
                            foo: element({}, { required: true }),
                        }),
                    })
                )
            ).toThrowError('Expected at least 1 occurrences of foo but was 0')
        })
    })

    describe('when an array has fewer elements than minOccurs', () => {
        it('throws an XmlSchemaError', () => {
            const rules = mapXmlRules({
                root: element({
                    foo: elements({}, { minOccurs: 2 }),
                }),
            })
            expect(() =>
                stringifyXml(
                    {
                        root: {
                            foo: [{}],
                        },
                    },
                    rules
                )
            ).toThrowError('Expected at least 2 occurrences of foo but was 1')

            expect(() =>
                stringifyXml(
                    {
                        root: {
                            foo: undefined,
                        },
                    },
                    rules
                )
            ).toThrowError('Expected at least 2 occurrences of foo but was 0')

            expect(() =>
                stringifyXml(
                    {
                        root: {},
                    },
                    rules
                )
            ).toThrowError('Expected at least 2 occurrences of foo but was 0')
        })
    })

    describe('when an array has more elements than maxOccurs', () => {
        it('throws an XmlSchemaError', () => {
            expect(() =>
                stringifyXml(
                    {
                        root: {
                            foo: [{}, {}, {}],
                        },
                    },
                    mapXmlRules({
                        root: element({
                            foo: elements(
                                {},
                                { maxOccurs: 2, useEmptyArrays: true }
                            ),
                        }),
                    })
                )
            ).toThrowError('Expected at most 2 occurrences of foo but was 3')
        })
    })

    describe('when an elements rule has minOccurs 0', () => {
        describe('and the array is undefined', () => {
            it('does not serialize the property', () => {
                interface Doc {
                    root: {
                        e?: readonly AnyRecord[]
                    }
                }

                const rules = mapXmlRules<Doc>({
                    root: element(
                        {
                            e: elements({}, { minOccurs: 0 }),
                        },
                        { required: true }
                    ),
                })
                expect(
                    stringifyXml(
                        {
                            root: {},
                        },
                        rules
                    )
                ).toEqual('<?xml version="1.0"?>\n<root/>')
            })
        })
    })
})
