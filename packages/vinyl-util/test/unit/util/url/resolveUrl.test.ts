/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getHostname,
    getLocation,
    isNode,
    resolveUrl,
} from '@amazon/vinyl-util'

/**
 * Asserts that resolveUrl produces the same result as new URL().
 */
function expectParity(relative: string, base: string, expected: string) {
    const actual = resolveUrl(relative, base)
    const urlResult = new URL(relative, base).href
    expect(actual).toBe(expected)
    expect(actual).toBe(urlResult)
}

describe('resolveUrl', () => {
    it('returns absolute URIs as-is', () => {
        expectParity(
            'https://other.com/a',
            'https://base.com/',
            'https://other.com/a'
        )
    })

    it('resolves protocol-relative URIs', () => {
        expectParity(
            '//other.com/a',
            'https://base.com/',
            'https://other.com/a'
        )
    })

    it('resolves absolute paths', () => {
        expectParity(
            '/foo/bar',
            'https://base.com/old/path',
            'https://base.com/foo/bar'
        )
    })

    it('returns base for empty relative', () => {
        expectParity('', 'https://base.com/path', 'https://base.com/path')
    })

    it('resolves relative paths', () => {
        expectParity(
            'seg.mp4',
            'https://base.com/dir/manifest',
            'https://base.com/dir/seg.mp4'
        )
    })

    it('resolves dot segments', () => {
        expectParity(
            '../other/seg.mp4',
            'https://base.com/a/b/manifest',
            'https://base.com/a/other/seg.mp4'
        )
    })

    it('resolves relative to a manifest URL', () => {
        expectParity(
            'test.mpd',
            'https://vinyl.music.amazon.dev/demo/index.html',
            'https://vinyl.music.amazon.dev/demo/test.mpd'
        )
    })

    it('returns base as-is for empty relative', () => {
        expectParity(
            '',
            'https://vinyl.music.amazon.dev/demo/index.html',
            'https://vinyl.music.amazon.dev/demo/index.html'
        )
    })

    it('resolves ./ to the base directory', () => {
        expectParity(
            './',
            'https://vinyl.music.amazon.dev/demo/index.html',
            'https://vinyl.music.amazon.dev/demo/'
        )
    })

    it('handles base without path', () => {
        expectParity('seg.mp4', 'https://base.com', 'https://base.com/seg.mp4')
    })

    it('resolves relative path without dots', () => {
        expectParity(
            'segment',
            'https://base.com/dir/manifest',
            'https://base.com/dir/segment'
        )
    })
})

describe('getLocation', () => {
    beforeEach(() => {
        if (!isNode()) pending('requires node')
    })

    it('returns empty strings when location is undefined', () => {
        const loc = getLocation()
        expect(loc.origin).toBe('')
        expect(loc.search).toBe('')
        expect(loc.href).toBe('')
    })

    describe('when location exists', () => {
        beforeEach(() => {
            if (isNode()) {
                ;(global as any).location = {
                    origin: 'https://loc.test',
                    search: '?q=1',
                    href: 'https://loc.test/page?q=1',
                }
            }
        })

        afterEach(() => {
            if (isNode()) {
                delete (global as any).location
            }
        })

        it('returns the global location', () => {
            const loc = getLocation()
            expect(loc.origin).toBe(location.origin)
            expect(loc.search).toBe(location.search)
            expect(loc.href).toBe(location.href)
        })
    })
})

describe('getHostname', () => {
    it('extracts hostname from a URL', () => {
        expect(getHostname('https://example.com/path')).toBe('example.com')
    })

    it('extracts hostname from a URL with port', () => {
        expect(getHostname('https://example.com:8080/path')).toBe('example.com')
    })

    it('extracts hostname from a URL without path', () => {
        expect(getHostname('https://example.com')).toBe('example.com')
    })
})
