/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentType } from '@/streaming/MediaQualityMetadata'

/**
 * RFC 6381 codec prefixes for video content.
 */
const VIDEO_CODEC_PREFIXES = [
    'avc1',
    'avc3',
    'hvc1',
    'hev1',
    'vp09',
    'av01',
    'dvh1',
    'dvhe',
] as const

/**
 * RFC 6381 codec prefixes for audio content.
 */
const AUDIO_CODEC_PREFIXES = ['mp4a', 'ac-3', 'ec-3', 'opus', 'flac'] as const

/**
 * RFC 6381 codec prefixes for text/subtitle content.
 */
const TEXT_CODEC_PREFIXES = ['stpp', 'wvtt'] as const

/**
 * Returns the ContentType for a single RFC 6381 codec string, or null if
 * unrecognized.
 */
export function codecToContentType(codec: string): ContentType | null {
    const lower = codec.trim().toLowerCase()
    for (const p of VIDEO_CODEC_PREFIXES) {
        if (lower.startsWith(p)) return 'video'
    }
    for (const p of AUDIO_CODEC_PREFIXES) {
        if (lower.startsWith(p)) return 'audio'
    }
    for (const p of TEXT_CODEC_PREFIXES) {
        if (lower.startsWith(p)) return 'text'
    }
    return null
}

/**
 * Splits a comma-separated CODECS attribute value and returns the set of
 * ContentType values present.
 */
export function codecsToContentTypes(codecs: string): Set<ContentType> {
    const types = new Set<ContentType>()
    for (const codec of codecs.split(',')) {
        const type = codecToContentType(codec)
        if (type) types.add(type)
    }
    return types
}

/**
 * Returns the full MIME type string for a content type, optionally with codecs.
 */
export function contentTypeToMimeType(
    contentType: ContentType,
    codecs: string | null
): string {
    const base = contentType === 'video' ? 'video/mp4' : 'audio/mp4'
    return codecs ? `${base}; codecs="${codecs}"` : base
}
