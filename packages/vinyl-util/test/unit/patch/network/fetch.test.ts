/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Fetch,
    patchFetch,
    requiresPreventCacheRangeRequestsPatch,
    setUserAgent,
} from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

describe('requiresPreventCacheRangeRequestsPatch', () => {
    function testForUa(userAgent: string, expected: boolean) {
        setUserAgent(userAgent)
        expect(requiresPreventCacheRangeRequestsPatch())
            .withContext(`requiresPreventCacheRangeRequestsPatch`)
            .toEqual(expected)
    }

    it('returns true for chrome < 65', () => {
        testForUa('Chrome/64.99.99', true)
        testForUa('Chrome/64.0.3282.119', true)
        testForUa('Chrome/50.0.0', true)

        testForUa('Version/17.2.1 Safari/605.1.15', false)
        testForUa('Version/16.0.0 Safari/605.1.15', false)
        testForUa('Firefox/24.0', false)
        testForUa('Chrome/65.0.0', false)
    })
})

describe('patchFetch', () => {
    let mockFetch: Spy<Fetch>
    let mockResponse: Response

    beforeEach(() => {
        mockResponse = new Response()
        mockFetch = createSpy('fetch').and.resolveTo(mockResponse)
    })

    describe('for Chrome < 65', () => {
        let patched: Fetch

        beforeEach(() => {
            setUserAgent('Chrome/63.0')
            patched = patchFetch(mockFetch)
        })

        describe('when request is a range request', () => {
            const requestInit: RequestInit = {
                headers: {
                    range: 'bytes: 123-421',
                },
            }

            describe('when the request fails with a TypeError', () => {
                it('retries with a cache buster', async () => {
                    mockFetch.and.returnValues(
                        Promise.reject(new TypeError('typeError')),
                        Promise.resolve(mockResponse)
                    )

                    const response = await patched(
                        'https://example.com',
                        requestInit
                    )
                    expect(response).toBe(mockResponse)
                    expect(
                        (mockFetch.calls.argsFor(1)[0] as URL).searchParams.has(
                            '__cache'
                        )
                    ).toBeTrue()
                })
            })

            describe('when the request fails with a non-TypeError', () => {
                it('does not modify the response', async () => {
                    mockFetch.and.returnValues(
                        Promise.reject(new Error('non-typeError')),
                        Promise.resolve(mockResponse)
                    )
                    await expectAsync(
                        patched('https://example.com')
                    ).toBeRejectedWithError(Error)
                })
            })
        })

        describe('when request is not a range request', () => {
            it('does not modify the request', async () => {
                mockFetch.and.returnValues(
                    Promise.reject(new TypeError('typeError')),
                    Promise.resolve(mockResponse)
                )
                await expectAsync(
                    patched('https://example.com')
                ).toBeRejectedWithError(TypeError)
            })
        })
    })

    describe('for unaffected browsers', () => {
        beforeEach(() => {
            setUserAgent('Chrome/66.0')
        })

        it('does not modify the fetch', () => {
            expect(patchFetch(mockFetch)).toBe(mockFetch)
        })
    })
})
