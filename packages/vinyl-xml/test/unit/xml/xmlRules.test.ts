/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AttributeRule,
    CharactersRule,
    ElementRule,
    ElementsRule,
} from '@amazon/vinyl-xml'
import {
    attr,
    attrBoolean,
    attrDateTime,
    attrFloat,
    attrInt,
    attrString,
    characters,
    element,
    elements,
    XmlRuleType,
} from '@amazon/vinyl-xml'
import type { AnyRecord, ReadonlyDate } from '@amazon/vinyl-util'
import {
    parseBoolean,
    parseDate,
    stringify,
    stringifyDate,
} from '@amazon/vinyl-util'
import { expectTypeEquals } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any

describe('xmlRules', () => {
    describe('attr', () => {
        it('provides a required attribute rule when required is true', () => {
            const _rule = attr(
                () => 1,
                () => '',
                { required: true }
            )
            expectTypeEquals<typeof _rule, AttributeRule<number>>(true)
        })

        it('provides an optional attribute rule when required is true', () => {
            const _rule = attr(
                () => 1,
                () => ''
            )
            expectTypeEquals<typeof _rule, AttributeRule<number>>(false)
            expectTypeEquals<typeof _rule, AttributeRule<number | undefined>>(
                true
            )
        })

        it('sets defaults when options are empty', () => {
            const parse = () => 1
            const stringify = () => ''
            const rule = attr(parse, stringify)
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: undefined,
                namespaceUri: null,
                required: false,
                default: undefined,
                parse,
                stringify,
            })
        })

        it('overrides defaults when options are set', () => {
            const parse = () => 1
            const stringify = () => ''
            const rule = attr(parse, stringify, {
                default: 2,
                localPart: 'local',
                namespaceUri: 'test',
                required: true,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                default: 2,
                localPart: 'local',
                namespaceUri: 'test',
                required: true,
                parse,
                stringify,
            })
        })
    })

    describe('element', () => {
        describe('ElementRule', () => {
            it('preserves exact typing', () => {
                expectTypeEquals<
                    ElementRule<AnyRecord | undefined>,
                    ElementRule<AnyRecord>
                >(false)
            })
        })

        it('provides a required element rule when required is true', () => {
            const _rule = element<AnyRecord>({}, { required: true })
            expectTypeEquals<typeof _rule, ElementRule<AnyRecord>>(true)
        })

        it('provides an optional element rule when required is true', () => {
            const _rule = element<AnyRecord>({})
            expectTypeEquals<typeof _rule, ElementRule<AnyRecord>>(false)
            expectTypeEquals<typeof _rule, ElementRule<AnyRecord | undefined>>(
                true
            )
        })

        it('sets defaults when options are empty', () => {
            const rules = {}
            const rule = element(rules)
            expect(rule).toEqual({
                type: XmlRuleType.ELEMENT,
                localPart: undefined,
                namespaceUri: undefined,
                required: false,
                rules,
            })
        })

        it('overrides defaults when options are set', () => {
            const rules = {}
            const rule = element(rules, {
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ELEMENT,
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                rules,
            })
        })
    })

    describe('elements', () => {
        describe('ElementsRule', () => {
            it('preserves exact typing', () => {
                expectTypeEquals<
                    ElementsRule<AnyRecord[] | undefined>,
                    ElementsRule<AnyRecord[]>
                >(false)

                expectTypeEquals<
                    ElementsRule<readonly AnyRecord[]>,
                    ElementsRule<AnyRecord[]>
                >(false)
            })
        })

        it('provides a required elements rule when minOccurs is greater than one', () => {
            const _rule = elements<AnyRecord>({}, { minOccurs: 1 })
            expectTypeEquals<typeof _rule, ElementsRule<readonly AnyRecord[]>>(
                true
            )
            expectTypeEquals<typeof _rule.rules, AnyRecord>(true)
        })

        it('provides an optional elements rule if minOccurs is zero', () => {
            const _optionalRule = elements<AnyRecord>({}, { minOccurs: 0 })
            expectTypeEquals<
                typeof _optionalRule,
                ElementsRule<readonly AnyRecord[] | undefined>
            >(true)

            expectTypeEquals<
                typeof _optionalRule,
                ElementsRule<readonly AnyRecord[]>
            >(false)
        })

        it('provides a required elements rule when useEmptyArrays is true', () => {
            const _rule = elements<AnyRecord>({}, { useEmptyArrays: true })
            expectTypeEquals<typeof _rule, ElementsRule<readonly AnyRecord[]>>(
                true
            )
            expectTypeEquals<typeof _rule.rules, AnyRecord>(true)
        })

        it('provides an optional elements rule with default options', () => {
            const _rule = elements<AnyRecord>({})
            expectTypeEquals<typeof _rule, ElementsRule<readonly AnyRecord[]>>(
                false
            )
            expectTypeEquals<
                typeof _rule,
                ElementsRule<readonly AnyRecord[] | undefined>
            >(true)
        })

        it('sets defaults when options are empty', () => {
            const rules = {}
            const rule = elements(rules)
            expect(rule).toEqual({
                type: XmlRuleType.ELEMENTS,
                localPart: undefined,
                namespaceUri: undefined,
                minOccurs: 0,
                maxOccurs: null,
                useEmptyArrays: false,
                rules,
            })
        })

        it('overrides defaults when options are set', () => {
            const rules = {}
            const rule = elements(rules, {
                localPart: 'local',
                namespaceUri: 'ns1',
                minOccurs: 1,
                maxOccurs: 2,
                useEmptyArrays: true,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ELEMENTS,
                localPart: 'local',
                namespaceUri: 'ns1',
                minOccurs: 1,
                maxOccurs: 2,
                useEmptyArrays: true,
                rules,
            })
        })
    })

    describe('characters', () => {
        describe('CharactersRule', () => {
            it('preserves exact typing', () => {
                expectTypeEquals<
                    CharactersRule<AnyRecord[] | undefined>,
                    CharactersRule<AnyRecord[]>
                >(false)

                expectTypeEquals<
                    CharactersRule<readonly AnyRecord[]>,
                    CharactersRule<AnyRecord[]>
                >(false)
            })
        })

        it('returns a characters rule', () => {
            const parse = () => 1
            const stringify = () => ''
            const rule = characters(parse, stringify)
            expect(rule).toEqual({
                type: XmlRuleType.CHARACTERS,
                parse,
                stringify,
            })
        })
    })

    describe('attrString', () => {
        it('returns an attribute rule with noop parse and stringify', () => {
            const rule = attrString()
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: undefined,
                namespaceUri: null,
                required: false,
                default: undefined,
                parse: any(Function),
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<string | undefined>>(
                true
            )
        })

        it('allows options', () => {
            const rule = attrString({
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: 'test',
            })
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: 'test',
                parse: any(Function),
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<string>>(true)
        })
    })

    describe('attrInt', () => {
        it('returns an attribute rule with int parse and stringify', () => {
            const rule = attrInt()
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: undefined,
                namespaceUri: null,
                required: false,
                default: undefined,
                parse: parseInt,
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<number | undefined>>(
                true
            )
        })

        it('allows options', () => {
            const rule = attrInt({
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: 1,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: 1,
                parse: parseInt,
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<number>>(true)
        })
    })

    describe('attrFloat', () => {
        it('returns an attribute rule with float parse and stringify', () => {
            const rule = attrFloat()
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: undefined,
                namespaceUri: null,
                required: false,
                default: undefined,
                parse: parseFloat,
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<number | undefined>>(
                true
            )
        })

        it('allows options', () => {
            const rule = attrFloat({
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: 1.1,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: 1.1,
                parse: any(Function),
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<number>>(true)
        })
    })

    describe('attrBoolean', () => {
        it('returns an attribute rule with boolean parse and stringify', () => {
            const rule = attrBoolean()
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: undefined,
                namespaceUri: null,
                required: false,
                default: undefined,
                parse: parseBoolean,
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<boolean | undefined>>(
                true
            )
        })

        it('allows options', () => {
            const rule = attrBoolean({
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: true,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: true,
                parse: any(Function),
                stringify,
            })
            expectTypeEquals<typeof rule, AttributeRule<boolean>>(true)
        })
    })

    describe('attrDateTime', () => {
        it('returns an attribute rule with date time parse and stringify', () => {
            const rule = attrDateTime()
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: undefined,
                namespaceUri: null,
                required: false,
                default: undefined,
                parse: parseDate,
                stringify: stringifyDate,
            })
            expectTypeEquals<
                typeof rule,
                AttributeRule<ReadonlyDate | undefined>
            >(true)
        })

        it('allows options', () => {
            const date = new Date('2020-01-01T00:00:00Z')
            const rule = attrDateTime({
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: date,
            })
            expect(rule).toEqual({
                type: XmlRuleType.ATTRIBUTE,
                localPart: 'local',
                namespaceUri: 'ns1',
                required: true,
                default: date,
                parse: parseDate,
                stringify: stringifyDate,
            })
            expectTypeEquals<typeof rule, AttributeRule<ReadonlyDate>>(true)
        })
    })
})
