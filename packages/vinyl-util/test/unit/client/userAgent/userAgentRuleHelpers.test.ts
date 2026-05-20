/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    parseVersion,
    tokenizeUserAgent,
    uaDeviceRule,
    uaName,
    uaPlatformOrSystemRule,
    uaPlatformRule,
    uaSystemRule,
} from '@amazon/vinyl-util'

describe('userAgentRuleHelpers', () => {
    const emptyTokenizedUa = tokenizeUserAgent('')

    describe('uaPlatformRule', () => {
        it('matches platform queries and sets name', () => {
            const t = tokenizeUserAgent('Foo/123 (Bar 456)')
            expect(uaPlatformRule('Name', 'foo')(t)).toEqual({
                name: 'Name',
                version: parseVersion('123'),
            })
            expect(uaPlatformRule('Name', 'bar')(t)).toBeNull()
        })
    })

    describe('uaSystemRule', () => {
        it('matches system queries and sets name', () => {
            const t = tokenizeUserAgent('Foo/123 (Bar 456)')
            expect(uaSystemRule('Name', 'bar', true)(t)).toEqual({
                name: 'Name',
                version: parseVersion('456'),
            })
            expect(uaSystemRule('Name', 'foo', true)(t)).toBeNull()
        })

        describe('when hasVersion is false', () => {
            it('sets version to null', () => {
                const t = tokenizeUserAgent('Foo/123 (Bar 456)')
                expect(uaSystemRule('Name', 'bar', false)(t)).toEqual({
                    name: 'Name',
                    version: null,
                })
            })
        })
    })

    describe('uaPlatformOrSystemRule', () => {
        it('matches system queries and sets name', () => {
            const t = tokenizeUserAgent('Foo/123 (Bar 456)')
            expect(uaPlatformOrSystemRule('Name', 'bar')(t)).toEqual({
                name: 'Name',
                version: parseVersion('456'),
            })
            expect(uaPlatformOrSystemRule('Name', 'foo')(t)).toEqual({
                name: 'Name',
                version: parseVersion('123'),
            })
        })
    })

    describe('uaName', () => {
        it('changes the name property from a returned inner rule', () => {
            expect(
                uaName('name', () => {
                    return { name: 'other', version: parseVersion('123') }
                })(emptyTokenizedUa)
            ).toEqual({
                name: 'name',
                version: parseVersion('123'),
            })
        })
    })

    describe('uaDeviceRule', () => {
        it('matches system or platform parts and sets vendor and type', () => {
            const t = tokenizeUserAgent('Foo/123 (Bar 456)')
            expect(uaDeviceRule('Vendor', 'Type', 'bar')(t)).toEqual({
                vendor: 'Vendor',
                type: 'Type',
                model: 'Bar 456',
            })
            expect(uaDeviceRule('Vendor', 'Type', 'foo')(t)).toEqual({
                vendor: 'Vendor',
                type: 'Type',
                model: 'Foo',
            })
        })
    })
})
