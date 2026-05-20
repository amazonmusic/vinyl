/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MappedElementsRule, XmlRules } from '@amazon/vinyl-xml'
import {
    attr,
    attrString,
    characters,
    charactersString,
    element,
    elements,
    mapXmlRules,
    xmlRuleKey,
} from '@amazon/vinyl-xml'
import { IllegalArgumentError, stringify } from '@amazon/vinyl-util'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('mappedXmlRules', () => {
    describe('mapXmlRules', () => {
        it('separates rules by type', () => {
            const noop = <T>(s: T): T => s
            const mapped = mapXmlRules<any>({
                a: attr(noop, noop),
                b: attr(noop, noop),
                c: attr(noop, noop),
                d: element({
                    e: attr(noop, noop),
                }),
                e: elements<any>({
                    f: attr(noop, noop),
                }),
                f: characters(noop, noop),
            })
            expect(mapped.attributes.size).toBe(3)
            expect(mapped.elements.size).toBe(2)

            expect(mapped.attributes.get(xmlRuleKey('b'))).toEqual({
                property: 'b',
                required: false,
                parse: noop,
                stringify: noop,
                default: undefined,
                localPart: 'b',
                namespaceUri: null,
            })
            expect(mapped.attributes.get(xmlRuleKey('c'))).toEqual({
                property: 'c',
                required: false,
                parse: noop,
                stringify: noop,
                default: undefined,
                localPart: 'c',
                namespaceUri: null,
            })
            expect(mapped.characters).toEqual({
                property: 'f',
                parse: noop,
                stringify: noop,
            })
            expect(mapped.elements.get(xmlRuleKey('d'))).toEqual({
                array: false,
                rules: any(Function),
                property: 'd',
                minOccurs: 0,
                maxOccurs: 1,
                useEmptyArrays: false,
                localPart: 'd',
                namespaceUri: null,
            })
        })

        it('allows for lazy rules and recursion', () => {
            interface TestA {
                a: number
                b: TestA
            }

            const testARules: XmlRules<TestA> = {
                a: () => attr(parseInt, stringify, { required: true }),
                b: () => element(testARules, { required: true }),
            }
            const mapped = mapXmlRules(testARules, null)
            expect(mapped.attributes.size).toBe(1)
            expect(mapped.elements.size).toBe(1)
            expect(
                mapped.elements
                    .get(xmlRuleKey('b'))!
                    .rules()
                    .attributes.get(xmlRuleKey('a'))
            ).toEqual({
                property: 'a',
                parse: parseInt,
                stringify,
                required: true,
                default: undefined,
                localPart: 'a',
                namespaceUri: null,
            })
            expect(
                mapped.elements
                    .get(xmlRuleKey('b'))!
                    .rules()
                    .elements.get(xmlRuleKey('b'))
            ).toEqual(
                objectContaining<MappedElementsRule>({
                    property: 'b',
                    array: false,
                    minOccurs: 1,
                    maxOccurs: 1,
                })
            )
        })

        it(`uses the handler's localPart if defined in the QName`, () => {
            interface TestA {
                a?: string
                b?: any
            }

            const testARules: XmlRules<TestA> = {
                a: () => attr((v) => v, stringify, { localPart: 'a_test' }),
                b: () => element({}, { localPart: 'b_test' }),
            }
            const mapped = mapXmlRules(testARules, null)
            expect(mapped.attributes.size).toBe(1)
            expect(mapped.elements.size).toBe(1)
            expect(mapped.characters).toBeUndefined()
            expect(mapped.attributes.get(xmlRuleKey('a_test'))).toBeDefined()
            expect(mapped.elements.get(xmlRuleKey('b_test'))).toBeDefined()
        })

        it(`uses the handler's namespaceUri if defined in the QName`, () => {
            const testARules: XmlRules<any> = {
                a: () =>
                    attr((v) => v, stringify, {
                        localPart: 'a_test',
                        namespaceUri: 'ns1',
                    }),
                b: () =>
                    attr((v) => v, stringify, {
                        localPart: 'a_test',
                        namespaceUri: null,
                    }),
                c: () =>
                    element({}, { localPart: 'b_test', namespaceUri: 'ns2' }),
                d: () =>
                    element({}, { localPart: 'b_test', namespaceUri: null }),
            }
            const mapped = mapXmlRules(testARules, null)
            expect(mapped.attributes.size).toBe(2)
            expect(mapped.elements.size).toBe(2)
            expect(mapped.characters).toBeUndefined()
            expect(
                mapped.attributes.get(xmlRuleKey('a_test', 'ns1'))
            ).toBeDefined()
            expect(mapped.attributes.get(xmlRuleKey('a_test'))).toBeDefined()
            expect(
                mapped.elements.get(xmlRuleKey('b_test', 'ns2'))
            ).toBeDefined()
            expect(mapped.elements.get(xmlRuleKey('b_test'))).toBeDefined()
        })

        it('does not allow multiple character handlers', () => {
            const testARules: XmlRules<any> = {
                a: charactersString,
                b: charactersString,
            }
            expect(() => mapXmlRules(testARules, null)).toThrowError(
                IllegalArgumentError
            )
        })

        it('does not allow multiple element handlers with the same localPart', () => {
            const testARules: XmlRules<any> = {
                a: element({}), // Defaults to property name
                b: element({}, { localPart: 'a' }),
            }
            expect(() => mapXmlRules(testARules, null)).toThrowMatching(
                (e) => e instanceof IllegalArgumentError
            )
        })

        it('does not allow multiple element handlers with the same qName', () => {
            const testARules: XmlRules<any> = {
                a: element({}, { localPart: 'a', namespaceUri: 'ns1' }),
                b: element({}, { localPart: 'a', namespaceUri: 'ns1' }),
            }
            expect(() => mapXmlRules(testARules, null)).toThrowMatching(
                (e) => e instanceof IllegalArgumentError
            )
        })

        it('does not allow multiple attribute handlers with the same qName', () => {
            const testARules: XmlRules<any> = {
                a: attrString({ localPart: 'a', namespaceUri: 'ns1' }),
                b: attrString({ localPart: 'a', namespaceUri: 'ns1' }),
            }
            expect(() => mapXmlRules(testARules, null)).toThrowMatching(
                (e) => e instanceof IllegalArgumentError
            )
        })
    })

    describe('xmlRuleKey', () => {
        it('returns :localPart when namespaceUri is null', () => {
            expect(xmlRuleKey('localPart', null)).toBe(':localPart')
        })

        it('returns namespaceUri:localPart when namespaceUri is null', () => {
            expect(xmlRuleKey('localPart', 'namespaceUri')).toBe(
                'namespaceUri:localPart'
            )
        })
    })
})
