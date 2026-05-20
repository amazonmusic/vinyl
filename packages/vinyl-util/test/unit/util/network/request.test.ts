/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    changeRequestInputUrl,
    getHeaderFromHeadersInit,
    getHeaderFromRequestParams,
    IllegalArgumentError,
    normalizeHeadersInit,
} from '@amazon/vinyl-util'
import objectContaining = jasmine.objectContaining

describe('request utils', () => {
    describe('getHeaderFromRequestParams', () => {
        it('gets the header from the Request or RequestInit object', () => {
            const request = new Request('https://example.com')
            request.headers.append('keY123', 'value1')
            request.headers.append('KeY456', 'value2')
            expect(getHeaderFromRequestParams(request, null, 'key123')).toEqual(
                'value1'
            )
            expect(getHeaderFromRequestParams(request, null, 'key456')).toEqual(
                'value2'
            )

            expect(
                getHeaderFromRequestParams(
                    'https://example.com',
                    {
                        headers: { KEy123: 'value1', key456: 'value2' },
                    },
                    'key456'
                )
            ).toEqual('value2')

            expect(
                getHeaderFromRequestParams('https://example.com', {}, 'key456')
            ).toBeNull()

            expect(
                getHeaderFromRequestParams(
                    new Request('https://example.com'),
                    {},
                    'key456'
                )
            ).toBeNull()
        })
    })

    describe('getHeaderFromHeadersInit', () => {
        describe('when headers is a Headers instance', () => {
            it('returns the matching value from case-insensitive key', () => {
                expect(
                    getHeaderFromHeadersInit(
                        new Headers({ KEy123: 'value1', key456: 'value2' }),
                        'Key123'
                    )
                ).toEqual('value1')
            })
        })

        describe('when headers is an array', () => {
            it('returns the matching value from case-insensitive key', () => {
                expect(
                    getHeaderFromHeadersInit(
                        [
                            ['KeY123', 'value1'],
                            ['kEy456', 'value2'],
                        ],
                        'Key123'
                    )
                ).toEqual('value1')
                expect(
                    getHeaderFromHeadersInit(
                        [
                            ['kE123', 'value1'],
                            ['keY456', 'value2'],
                        ],
                        'KEY456'
                    )
                ).toEqual('value2')
                expect(
                    getHeaderFromHeadersInit(
                        [
                            ['key123', 'value1'],
                            ['key456', 'value2'],
                        ],
                        'nonexistent'
                    )
                ).toBeNull()
            })
        })

        describe('when headers is an object', () => {
            it('returns the matching value from case-insensitive key', () => {
                expect(
                    getHeaderFromHeadersInit(
                        { KEy123: 'value1', key456: 'value2' },
                        'Key123'
                    )
                ).toEqual('value1')
                expect(
                    getHeaderFromHeadersInit(
                        { kEy123: 'value1', Key456: 'value2' },
                        'KEY456'
                    )
                ).toEqual('value2')
                expect(
                    getHeaderFromHeadersInit(
                        { key123: 'value1', key456: 'value2' },
                        'nonexistent'
                    )
                ).toBeNull()
            })
        })

        describe('when headers is an unexpected type', () => {
            it('throws an IllegalArgumentError', () => {
                expect(() =>
                    getHeaderFromHeadersInit(
                        // @ts-expect-error Expected a RequestInit type.
                        'test',
                        'any'
                    )
                ).toThrowError(IllegalArgumentError)
            })
        })
    })

    describe('changeRequestInputUrl', () => {
        describe('when input is a string', () => {
            it('provides a URL to transform', () => {
                expect(
                    changeRequestInputUrl(
                        'https://example.com/foo.mp3',
                        (url) => url.searchParams.append('test', 'value')
                    )
                ).toEqual(
                    objectContaining({
                        href: 'https://example.com/foo.mp3?test=value',
                    })
                )
            })
        })

        describe('when input is a url', () => {
            it('provides a URL to transform', () => {
                const original = new URL('https://example.com/foo.mp3')
                expect(
                    changeRequestInputUrl(original, (url) =>
                        url.searchParams.append('test', 'value')
                    )
                ).toEqual(
                    objectContaining({
                        href: 'https://example.com/foo.mp3?test=value',
                    })
                )
                expect(original.toString()).toEqual(
                    'https://example.com/foo.mp3'
                )
            })
        })

        describe('when input is a Request', () => {
            it('provides a URL to transform', () => {
                const original = new Request('https://example.com/foo.mp3', {
                    method: 'POST',
                })
                expect(
                    changeRequestInputUrl(original, (url) =>
                        url.searchParams.append('test', 'value')
                    )
                ).toEqual(
                    objectContaining({
                        url: 'https://example.com/foo.mp3?test=value',
                    })
                )
                expect(original.url).toEqual('https://example.com/foo.mp3')
            })
        })
    })

    describe('normalizeHeadersInit', () => {
        it('returns an empty object when input is null', () => {
            expect(normalizeHeadersInit(null)).toEqual({})
        })

        it('converts a Headers object or Array of key-value pairs into an object of key-value pairs', () => {
            expect(
                normalizeHeadersInit(new Headers({ a: 'a1', b: 'b2', c: 'c3' }))
            ).toEqual({
                a: 'a1',
                b: 'b2',
                c: 'c3',
            })
            expect(
                normalizeHeadersInit([
                    ['a', 'a1'],
                    ['b', 'b2'],
                    ['c', 'c3'],
                ])
            ).toEqual({
                a: 'a1',
                b: 'b2',
                c: 'c3',
            })

            expect(
                normalizeHeadersInit({
                    a: 'a1',
                    b: 'b2',
                    c: 'c3',
                })
            ).toEqual({
                a: 'a1',
                b: 'b2',
                c: 'c3',
            })
        })
    })
})
