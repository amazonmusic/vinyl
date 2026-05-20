/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDefaultHlsManifestTransformer } from '@amazon/vinyl'
import { data } from '@amazon/vinyl-observable'
import type { MainPlaylist, VariantStream } from '@amazon/vinyl-hls-parser'
import type { HlsManifestData } from '@amazon/vinyl'

function variant(bandwidth: number): VariantStream {
    return { bandwidth, uri: `${bandwidth}.m3u8` }
}

function manifestData(variants: VariantStream[]): HlsManifestData {
    return {
        mainPlaylist: {
            variants,
            alternativeRenditions: [],
        } as unknown as MainPlaylist,
        baseUrl: 'https://example.com/',
        getMediaPlaylist: () => Promise.resolve(null as any),
    }
}

describe('createDefaultHlsManifestTransformer', () => {
    it('sorts variants by bandwidth descending', async () => {
        const input = manifestData([
            variant(500000),
            variant(2000000),
            variant(1000000),
        ])
        const controller = data(Promise.resolve(input))
        const transformer = createDefaultHlsManifestTransformer({
            manifestController: controller,
        })

        const result = await transformer.value
        const bandwidths = result.mainPlaylist.variants.map((v) => v.bandwidth)
        expect(bandwidths).toEqual([2000000, 1000000, 500000])
    })

    it('preserves other manifest data', async () => {
        const input = manifestData([variant(100)])
        const controller = data(Promise.resolve(input))
        const transformer = createDefaultHlsManifestTransformer({
            manifestController: controller,
        })

        const result = await transformer.value
        expect(result.baseUrl).toBe('https://example.com/')
        expect(result.mainPlaylist.alternativeRenditions).toEqual([])
    })

    it('handles single variant', async () => {
        const input = manifestData([variant(128000)])
        const controller = data(Promise.resolve(input))
        const transformer = createDefaultHlsManifestTransformer({
            manifestController: controller,
        })

        const result = await transformer.value
        expect(result.mainPlaylist.variants.length).toBe(1)
        expect(result.mainPlaylist.variants[0].bandwidth).toBe(128000)
    })

    it('handles already sorted variants', async () => {
        const input = manifestData([
            variant(3000000),
            variant(2000000),
            variant(1000000),
        ])
        const controller = data(Promise.resolve(input))
        const transformer = createDefaultHlsManifestTransformer({
            manifestController: controller,
        })

        const result = await transformer.value
        const bandwidths = result.mainPlaylist.variants.map((v) => v.bandwidth)
        expect(bandwidths).toEqual([3000000, 2000000, 1000000])
    })
})
