/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AdError,
    defaultAdLoadOptionsResolver,
    UnresolvableAdError,
} from '@amazon/vinyl'

describe('defaultAdLoadOptionsResolver', () => {
    it('resolves an ad URI with a known extension to load options', async () => {
        const options = await defaultAdLoadOptionsResolver({
            id: 'a1',
            startTime: 0,
            duration: 5,
            uri: 'https://cdn.example.com/ad.m3u8',
        })
        expect(options).toEqual({
            uri: 'https://cdn.example.com/ad.m3u8',
            type: 'hls',
        })
    })

    it('rejects with UnresolvableAdError when the ad has no URI', async () => {
        await expectAsync(
            defaultAdLoadOptionsResolver({
                id: 'a1',
                startTime: 0,
                duration: 5,
                uri: null,
            })
        ).toBeRejectedWithError(UnresolvableAdError)
    })

    it('rejects with UnresolvableAdError when the track type cannot be inferred', async () => {
        const origFetch = globalThis.fetch
        // A URL with no recognizable extension whose HEAD probe returns a
        // non-media content-type is untypeable.
        globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
            ok: true,
            status: 200,
            headers: { get: () => 'text/plain' },
        })
        try {
            await expectAsync(
                defaultAdLoadOptionsResolver({
                    id: 'a1',
                    startTime: 0,
                    duration: 5,
                    uri: 'https://cdn.example.com/untypeable-ad-asset',
                })
            ).toBeRejectedWithError(UnresolvableAdError)
        } finally {
            globalThis.fetch = origFetch
        }
    })
})

describe('ad error types', () => {
    it('AdError reports its toStringTag', () => {
        expect(new AdError('boom')[Symbol.toStringTag]).toBe('AdError')
    })

    it('UnresolvableAdError reports its toStringTag', () => {
        expect(new UnresolvableAdError('boom')[Symbol.toStringTag]).toBe(
            'UnresolvableAdError'
        )
    })
})
