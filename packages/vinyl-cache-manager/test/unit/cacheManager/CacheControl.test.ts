/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseCacheControl } from '@amazon/vinyl-cache-manager'

describe('parseCacheControl', () => {
    it('returns an empty object for null input', () => {
        expect(parseCacheControl(null)).toEqual({})
    })

    it('returns an empty object for undefined input', () => {
        expect(parseCacheControl(undefined)).toEqual({})
    })

    it('returns an empty object for an empty string', () => {
        expect(parseCacheControl('')).toEqual({})
    })

    it('parses boolean directives correctly', () => {
        const result = parseCacheControl(
            'no-store, no-cache, must-revalidate, public, private, immutable, only-if-cached'
        )
        expect(result).toEqual({
            noStore: true,
            noCache: true,
            mustRevalidate: true,
            public: true,
            private: true,
            immutable: true,
            onlyIfCached: true,
        })
    })

    it('parses numeric directives correctly', () => {
        const result = parseCacheControl(
            'max-age=3600, stale-while-revalidate=120, stale-if-error=86400'
        )
        expect(result).toEqual({
            maxAge: 3600,
            staleWhileRevalidate: 120,
            staleIfError: 86400,
        })
    })

    it('ignores unknown directives', () => {
        const result = parseCacheControl('foo=bar, max-age=1000, bar')
        expect(result).toEqual({
            maxAge: 1000,
        })
    })

    it('parses mixed boolean and numeric directives', () => {
        const result = parseCacheControl('no-store, max-age=3600')
        expect(result).toEqual({
            noStore: true,
            maxAge: 3600,
        })
    })

    it('ignores malformed numeric values and treats them as string', () => {
        const result = parseCacheControl('max-age=abc')
        expect(result).toEqual({
            maxAge: 'abc' as any,
        })
    })

    it('trims whitespace and handles case-insensitive directive names', () => {
        const result = parseCacheControl(
            '  MAX-AGE=123 , No-CaChe ,   Immutable  '
        )
        expect(result).toEqual({
            maxAge: 123,
            noCache: true,
            immutable: true,
        })
    })

    it('handles extra commas and whitespace gracefully', () => {
        const result = parseCacheControl(', , max-age=300 , , no-store ,,')
        expect(result).toEqual({
            maxAge: 300,
            noStore: true,
        })
    })
})
