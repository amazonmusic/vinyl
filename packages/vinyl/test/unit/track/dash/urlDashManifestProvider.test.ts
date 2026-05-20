/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { urlDashManifestProvider } from '@amazon/vinyl'
import {
    Abort,
    isNode,
    requesterWithRetryRef,
    type RequestInitOptions,
} from '@amazon/vinyl-util'
import { dash_segmentBase } from '@amazon/vinyl/vinylTestUtil'
import { MockRequester } from '@amazon/vinyl-util/testUtil'
import any = jasmine.any

describe('urlDashManifestProvider', () => {
    let mockRequester: MockRequester

    function initMockResponse() {
        mockRequester.request.and.resolveTo(new Response(dash_segmentBase))
    }

    beforeEach(() => {
        mockRequester = new MockRequester()
        requesterWithRetryRef.set(() => mockRequester)
        initMockResponse()
    })

    it('returns a Promise for the dash manifest at the given url', async () => {
        const init: RequestInitOptions = { method: 'GET' }
        const provider = urlDashManifestProvider('https://example.com', init)
        const abort = new Abort()
        const { manifest, baseUrl } = await provider(abort)
        expect(mockRequester.request).toHaveBeenCalledOnceWith(
            'https://example.com',
            init,
            { abort }
        )
        expect(baseUrl).toBe('https://example.com/')
        expect(manifest.MPD).toEqual(any(Object))
    })

    describe('when input url is absolute', () => {
        it('provides the input url as the base url', async () => {
            {
                const provider = urlDashManifestProvider(
                    'https://example.com/foo/myManifest.mpd'
                )
                expect((await provider()).baseUrl).toEqual(
                    'https://example.com/foo/'
                )
            }
            {
                const provider = urlDashManifestProvider(
                    'https://example.com/foo/myManifest.mpd'
                )
                initMockResponse()
                expect((await provider()).baseUrl).toEqual(
                    'https://example.com/foo/'
                )
            }
        })

        it('uses response.url for baseUrl when redirected', async () => {
            mockRequester.request.and.callFake(() => {
                const resp = new Response(dash_segmentBase)
                Object.defineProperty(resp, 'url', {
                    value: 'https://redirected.com/bar/myManifest.mpd',
                })
                return Promise.resolve(resp)
            })
            const provider = urlDashManifestProvider(
                'https://example.com/foo/myManifest.mpd'
            )
            expect((await provider()).baseUrl).toEqual(
                'https://redirected.com/bar/'
            )
        })
    })

    describe('when requestInterceptor is provided', () => {
        it('transforms the request parameters before fetching', async () => {
            const provider = urlDashManifestProvider(
                'https://example.com/foo/myManifest.mpd',
                {},
                (params) => {
                    params.input += '?added=value'
                    params.init.headers = {
                        myHeader: 'myHeaderValue',
                    }
                }
            )
            await provider()
            expect(mockRequester.request).toHaveBeenCalledOnceWith(
                'https://example.com/foo/myManifest.mpd?added=value',
                {
                    headers: {
                        myHeader: 'myHeaderValue',
                    },
                },
                any(Object)
            )
        })
    })

    describe('when input url is relative', () => {
        beforeEach(() => {
            if (!isNode()) return pending('requires node environment to test')
            global.location = {
                origin: 'https://example.com',
                href: 'https://example.com/',
            } as any
        })

        afterEach(() => {
            if (isNode()) delete (global as any).location
        })

        it('provides a baseUrl as absolute, relative to the origin', async () => {
            const provider = urlDashManifestProvider('./foo/myManifest.mpd')
            expect((await provider()).baseUrl).toEqual(
                'https://example.com/foo/'
            )
        })

        describe('when location is undefined', () => {
            // Only relevant for NODE
            beforeEach(() => {
                if (!isNode())
                    return pending('requires node environment to test')
                delete (global as any).location
            })

            it('resolves input against empty base', async () => {
                const provider = urlDashManifestProvider('./foo/myManifest.mpd')
                // Without URL construction, no validation occurs on the input string.
                // The provider proceeds with a path resolved against an empty base.
                const { manifest } = await provider()
                expect(manifest.MPD).toEqual(any(Object))
            })
        })
    })
})
