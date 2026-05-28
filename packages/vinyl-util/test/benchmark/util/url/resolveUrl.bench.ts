/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveUrl } from '@amazon/vinyl-util'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { addBenchmarks, setupBenchmark } from '../../setup'

describe('resolveUrl', () => {
    setupBenchmark()

    it('relative path', async () => {
        const name = 'relative path'
        const base = 'https://cdn.example.com/content/audio/'
        const relative = 'segment_001.mp4'

        const resolveUrlResults = await benchmark(`resolveUrl ${name}`, () => {
            const _o = resolveUrl(relative, base)
        })
        const newUrlResults = await benchmark(`new URL ${name}`, () => {
            const _o = new URL(relative, base).href
        })
        addBenchmarks(name, resolveUrlResults, newUrlResults)
    })

    it('absolute URI', async () => {
        const name = 'absolute URI'
        const base = 'https://cdn.example.com/content/audio/'
        const absolute = 'https://other.example.com/segment.mp4'

        const resolveUrlResults = await benchmark(`resolveUrl ${name}`, () => {
            const _o = resolveUrl(absolute, base)
        })
        const newUrlResults = await benchmark(`new URL ${name}`, () => {
            const _o = new URL(absolute, base).href
        })
        addBenchmarks(name, resolveUrlResults, newUrlResults)
    })

    it('dot segments', async () => {
        const name = 'dot segments'
        const base = 'https://cdn.example.com/a/b/c/manifest.mpd'
        const relative = '../../media/segment.mp4'

        const resolveUrlResults = await benchmark(`resolveUrl ${name}`, () => {
            const _o = resolveUrl(relative, base)
        })
        const newUrlResults = await benchmark(`new URL ${name}`, () => {
            const _o = new URL(relative, base).href
        })
        addBenchmarks(name, resolveUrlResults, newUrlResults)
    })

    it('chained resolution (DASH BaseURL walk)', async () => {
        const name = 'chained resolution'
        const manifest = 'https://cdn.example.com/manifest.mpd'
        const scopes = ['content/', 'audio/', '128k/']
        const segment = 'seg_001.m4s'

        const resolveUrlResults = await benchmark(`resolveUrl ${name}`, () => {
            let resolved = manifest
            for (const scope of scopes) {
                resolved = resolveUrl(scope, resolved)
            }
            resolveUrl(segment, resolved)
        })
        const newUrlResults = await benchmark(`new URL ${name}`, () => {
            let resolved = new URL(manifest)
            for (const scope of scopes) {
                resolved = new URL(scope, resolved)
            }
            const _o = new URL(segment, resolved).href
        })
        addBenchmarks(name, resolveUrlResults, newUrlResults)
    })
})
