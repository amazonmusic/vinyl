/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createTrackLoadOptionsFromUrl,
    inferTrackTypeFromUrl,
    inferTrackTypeFromUrlPath,
} from '@amazon/vinyl'
import { requesterWithRetryRef } from '@amazon/vinyl-util'
import { MockRequester, overrideGlobalInit } from '@amazon/vinyl-util/testUtil'

describe('inferTrackTypeFromUrlPath', () => {
    it('returns hls for .m3u8 extension', () => {
        expect(
            inferTrackTypeFromUrlPath('https://example.com/stream.m3u8')
        ).toBe('hls')
    })

    it('returns hls for .m3u8 with query params', () => {
        expect(
            inferTrackTypeFromUrlPath(
                'https://example.com/stream.m3u8?token=abc'
            )
        ).toBe('hls')
    })

    it('returns dash for .mpd extension', () => {
        expect(
            inferTrackTypeFromUrlPath('https://example.com/manifest.mpd')
        ).toBe('dash')
    })

    it('returns dash for .mpd with query params', () => {
        expect(
            inferTrackTypeFromUrlPath('https://example.com/manifest.mpd?v=1')
        ).toBe('dash')
    })

    it('returns src for common media extensions', () => {
        expect(inferTrackTypeFromUrlPath('https://example.com/audio.mp3')).toBe(
            'src'
        )
        expect(inferTrackTypeFromUrlPath('https://example.com/video.mp4')).toBe(
            'src'
        )
        expect(inferTrackTypeFromUrlPath('https://example.com/audio.aac')).toBe(
            'src'
        )
        expect(
            inferTrackTypeFromUrlPath('https://example.com/video.webm')
        ).toBe('src')
        expect(inferTrackTypeFromUrlPath('https://example.com/audio.ogg')).toBe(
            'src'
        )
        expect(inferTrackTypeFromUrlPath('https://example.com/audio.wav')).toBe(
            'src'
        )
        expect(inferTrackTypeFromUrlPath('https://example.com/audio.m4a')).toBe(
            'src'
        )
        expect(inferTrackTypeFromUrlPath('https://example.com/video.m4v')).toBe(
            'src'
        )
        expect(
            inferTrackTypeFromUrlPath('https://example.com/audio.opus')
        ).toBe('src')
    })

    it('returns src for media extensions with query params', () => {
        expect(
            inferTrackTypeFromUrlPath(
                'https://example.com/video.mp4?quality=high'
            )
        ).toBe('src')
    })

    it('returns null for unrecognized URIs', () => {
        expect(
            inferTrackTypeFromUrlPath('https://example.com/api/stream')
        ).toBeNull()
        expect(
            inferTrackTypeFromUrlPath('https://example.com/data.json')
        ).toBeNull()
    })
})

/**
 * Builds a minimal `fetch` Response stand-in that satisfies `requestWithRetry`
 * (which reads `ok`/`status`/`headers` and rejects on non-ok responses).
 */
function contentTypeResponse(contentType: string | null) {
    return {
        ok: true,
        status: 200,
        headers: {
            get: (header: string) =>
                header === 'content-type' ? contentType : null,
        },
    }
}

function notFoundResponse() {
    return {
        ok: false,
        status: 404,
        headers: { get: () => null },
    }
}

describe('inferTrackTypeFromUrl', () => {
    it('resolves from the extension without a network request', async () => {
        const origFetch = globalThis.fetch
        const fetchSpy = jasmine.createSpy('fetch')
        globalThis.fetch = fetchSpy
        try {
            expect(
                await inferTrackTypeFromUrl('https://example.com/a.m3u8')
            ).toBe('hls')
            expect(fetchSpy).not.toHaveBeenCalled()
        } finally {
            globalThis.fetch = origFetch
        }
    })

    it('falls through to a HEAD probe for extension-less URLs', async () => {
        const origFetch = globalThis.fetch
        const fetchSpy = jasmine
            .createSpy('fetch')
            .and.resolveTo(contentTypeResponse('video/mp4'))
        globalThis.fetch = fetchSpy
        try {
            expect(
                await inferTrackTypeFromUrl(
                    'https://example.com/probe-fallthru'
                )
            ).toBe('src')
            expect(fetchSpy).toHaveBeenCalledTimes(1)
            expect(fetchSpy.calls.argsFor(0)[1]).toEqual(
                jasmine.objectContaining({ method: 'HEAD' })
            )
        } finally {
            globalThis.fetch = origFetch
        }
    })
})

describe('probeType (via inferTrackTypeFromUrl)', () => {
    // Each spec uses a DISTINCT URL because probeType is memoized by URL, so a
    // shared URL would leak a cached result into later specs.
    async function probe(url: string, response: unknown) {
        const origFetch = globalThis.fetch
        globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(response)
        try {
            return await inferTrackTypeFromUrl(url)
        } finally {
            globalThis.fetch = origFetch
        }
    }

    it('maps application/dash+xml to dash', async () => {
        expect(
            await probe(
                'https://example.com/probe-dash',
                contentTypeResponse('application/dash+xml')
            )
        ).toBe('dash')
    })

    it('maps an mpegurl content-type to hls', async () => {
        expect(
            await probe(
                'https://example.com/probe-hls',
                contentTypeResponse('application/vnd.apple.mpegurl')
            )
        ).toBe('hls')
    })

    it('maps video/* content-types to src', async () => {
        expect(
            await probe(
                'https://example.com/probe-video',
                contentTypeResponse('video/mp4')
            )
        ).toBe('src')
    })

    it('maps audio/* content-types to src', async () => {
        expect(
            await probe(
                'https://example.com/probe-audio',
                contentTypeResponse('audio/mpeg')
            )
        ).toBe('src')
    })

    it('returns null for an unrecognized content-type', async () => {
        expect(
            await probe(
                'https://example.com/probe-unknown',
                contentTypeResponse('application/json')
            )
        ).toBeNull()
    })

    it('returns null when the content-type header is missing', async () => {
        expect(
            await probe(
                'https://example.com/probe-no-content-type',
                contentTypeResponse(null)
            )
        ).toBeNull()
    })

    it('returns null for a non-ok response', async () => {
        expect(
            await probe(
                'https://example.com/probe-not-found',
                notFoundResponse()
            )
        ).toBeNull()
    })

    it('returns null when the request throws', async () => {
        const origFetch = globalThis.fetch
        globalThis.fetch = jasmine
            .createSpy('fetch')
            .and.rejectWith(new Error('network down'))
        try {
            expect(
                await inferTrackTypeFromUrl('https://example.com/probe-throws')
            ).toBeNull()
        } finally {
            globalThis.fetch = origFetch
        }
    })
})

describe('probeType (non-ok resolved response)', () => {
    // The real requester rejects non-ok responses, so it can never resolve one
    // to probeType. Override it with a mock that resolves a non-ok Response to
    // exercise probeType's `!res.ok` guard.
    const mockRequesterRef = overrideGlobalInit(
        requesterWithRetryRef,
        () => new MockRequester()
    )

    it('returns null when the request resolves a non-ok response', async () => {
        mockRequesterRef.value.request.and.resolveTo(
            new Response(null, { status: 404 })
        )
        expect(
            await inferTrackTypeFromUrl(
                'https://example.com/probe-resolved-not-ok'
            )
        ).toBeNull()
    })
})

describe('createTrackLoadOptionsFromUrl', () => {
    it('returns uri and type for a typeable URL', async () => {
        expect(
            await createTrackLoadOptionsFromUrl(
                'https://example.com/create.m3u8'
            )
        ).toEqual({ uri: 'https://example.com/create.m3u8', type: 'hls' })
    })

    it('returns null for an empty string', async () => {
        expect(await createTrackLoadOptionsFromUrl('')).toBeNull()
    })

    it('returns null for an untypeable URL', async () => {
        const origFetch = globalThis.fetch
        globalThis.fetch = jasmine
            .createSpy('fetch')
            .and.resolveTo(contentTypeResponse('application/json'))
        try {
            expect(
                await createTrackLoadOptionsFromUrl(
                    'https://example.com/create-untypeable'
                )
            ).toBeNull()
        } finally {
            globalThis.fetch = origFetch
        }
    })
})
