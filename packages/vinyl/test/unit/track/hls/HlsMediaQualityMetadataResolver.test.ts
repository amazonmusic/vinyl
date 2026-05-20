/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDefaultHlsMediaQualityMetadataResolver,
    type HlsMediaQualityMetadataResolver,
} from '@amazon/vinyl'
import type {
    AlternativeRendition,
    VariantStream,
} from '@amazon/vinyl-hls-parser'

describe('HlsMediaQualityMetadataResolver', () => {
    let resolver: HlsMediaQualityMetadataResolver

    beforeEach(() => {
        resolver = createDefaultHlsMediaQualityMetadataResolver()
    })

    const baseVariant: VariantStream = {
        bandwidth: 500000,
        uri: 'variant.m3u8',
        codecs: 'avc1.640015,mp4a.40.2',
        width: 480,
        height: 270,
        frameRate: 30,
    }

    /** Creates a variant, omitting keys whose value is explicitly set to undefined. */
    function variant(overrides: Record<string, unknown> = {}): VariantStream {
        const result: Record<string, unknown> = {}
        const allKeys = new Set([
            ...Object.keys(baseVariant),
            ...Object.keys(overrides),
        ])
        for (const key of allKeys) {
            const value =
                key in overrides
                    ? overrides[key]
                    : (baseVariant as unknown as Record<string, unknown>)[key]
            if (value !== undefined) result[key] = value
        }
        return result as unknown as VariantStream
    }

    function audioRendition(
        overrides: Partial<AlternativeRendition> = {}
    ): AlternativeRendition {
        return {
            type: 'AUDIO',
            groupId: 'aud1',
            name: 'English',
            language: 'en',
            ...overrides,
        }
    }

    it('sets bandwidth to null and bandwidthTotal from variant', () => {
        const quality = resolver(variant({ bandwidth: 128000 }), [])
        expect(quality.bandwidth).toBeNull()
        expect(quality.bandwidthTotal).toBe(128000)
    })

    it('sets codecs from variant', () => {
        const quality = resolver(variant({ codecs: 'mp4a.40.2' }), [])
        expect(quality.codecs).toBe('mp4a.40.2')
    })

    it('sets contentType from first codec', () => {
        const quality = resolver(
            variant({ codecs: 'avc1.640015,mp4a.40.2' }),
            []
        )
        expect(quality.contentType).toBe('video')
    })

    it('sets contentType to audio for audio-only', () => {
        const quality = resolver(variant({ codecs: 'mp4a.40.2' }), [])
        expect(quality.contentType).toBe('audio')
    })

    it('sets contentType to null when codecs is undefined', () => {
        const quality = resolver(variant({ codecs: undefined }), [])
        expect(quality.contentType).toBeNull()
    })

    it('sets mimeType with codecs', () => {
        const quality = resolver(
            variant({ codecs: 'avc1.640015,mp4a.40.2' }),
            []
        )
        expect(quality.mimeType).toBe(
            'video/mp4; codecs="avc1.640015,mp4a.40.2"'
        )
    })

    it('sets mimeType to null when codecs is undefined', () => {
        const quality = resolver(variant({ codecs: undefined }), [])
        expect(quality.mimeType).toBeNull()
    })

    it('sets width and height from variant', () => {
        const quality = resolver(variant({ width: 1920, height: 1080 }), [])
        expect(quality.width).toBe(1920)
        expect(quality.height).toBe(1080)
    })

    it('sets width and height to null when undefined', () => {
        const quality = resolver(
            variant({ width: undefined, height: undefined }),
            []
        )
        expect(quality.width).toBeNull()
        expect(quality.height).toBeNull()
    })

    it('sets frameRate as tuple', () => {
        const quality = resolver(variant({ frameRate: 30 }), [])
        expect(quality.frameRate).toEqual([30, 1])
    })

    it('sets frameRate to null when undefined', () => {
        const quality = resolver(variant({ frameRate: undefined }), [])
        expect(quality.frameRate).toBeNull()
    })

    it('sets lang from matching audio rendition', () => {
        const quality = resolver(variant({ audioGroup: 'aud1' }), [
            audioRendition({ groupId: 'aud1', language: 'fr' }),
        ])
        expect(quality.lang).toBe('fr')
    })

    it('sets lang to null when no matching rendition', () => {
        const quality = resolver(variant({ audioGroup: 'aud1' }), [
            audioRendition({ groupId: 'aud2', language: 'fr' }),
        ])
        expect(quality.lang).toBeNull()
    })

    it('sets lang to null when no audioGroup', () => {
        const quality = resolver(variant({ audioGroup: undefined }), [
            audioRendition(),
        ])
        expect(quality.lang).toBeNull()
    })

    it('sets qualityId from bandwidth and codecs', () => {
        const quality = resolver(
            variant({ bandwidth: 500000, codecs: 'mp4a.40.2' }),
            []
        )
        expect(quality.qualityId).toBe('500000-mp4a.40.2')
    })

    it('sets decoderId from variant uri', () => {
        const quality = resolver(variant({ uri: 'foo.m3u8' }), [])
        expect(quality.decoderId).toBe('foo.m3u8')
    })

    it('sets DRM fields to empty/null', () => {
        const quality = resolver(variant(), [])
        expect(quality.contentProtections).toEqual([])
        expect(quality.encryptionScheme).toBeNull()
        expect(quality.initDataType).toBeNull()
    })

    it('sets audioSamplingRate to null', () => {
        const quality = resolver(variant(), [])
        expect(quality.audioSamplingRate).toBeNull()
    })

    it('sets supplementalProperties to empty object', () => {
        const quality = resolver(variant(), [])
        expect(quality.supplementalProperties).toEqual({})
    })

    it('sets groupId to default', () => {
        const quality = resolver(variant(), [])
        expect(quality.groupId).toBe('0')
    })

    it('sets switchingGroupIds to null to allow unrestricted switching', () => {
        const quality = resolver(variant(), [])
        expect(quality.switchingGroupIds).toBeNull()
    })
})
