/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RepresentationType } from '@amazon/vinyl-mpd-parser'
import type { ContentType } from '../../../streaming/MediaQualityMetadata'
import { codecToContentType } from '../../mse/codec'

export interface RepresentationMimeInfo {
    readonly mimeType: string | null
    readonly contentType: ContentType | null
}

/**
 * Returns the full mime type with codecs and the inferred content type from the
 * provided representation.
 */
export function getRepresentationMimeInfo(
    representation: RepresentationType
): RepresentationMimeInfo {
    const adaptationSet = representation.parent
    let mimeType = representation.mimeType ?? adaptationSet.mimeType
    const codecs = representation.codecs ?? adaptationSet.codecs
    if (!mimeType) {
        const contentType =
            (adaptationSet.contentType as ContentType | undefined) ??
            (codecs ? codecToContentType(codecs.split(',')[0]) : null)
        switch (contentType) {
            case 'audio':
                mimeType = 'audio/mp4'
                break
            case 'video':
                mimeType = 'video/mp4'
                break
            default:
                return { mimeType: null, contentType: null }
        }
        const fullMimeType = codecs
            ? `${mimeType}; codecs="${codecs}"`
            : mimeType
        return { mimeType: fullMimeType, contentType }
    }
    const fullMimeType = codecs ? `${mimeType}; codecs="${codecs}"` : mimeType
    let contentType: ContentType | null =
        (adaptationSet.contentType as ContentType | undefined) ?? null
    if (!contentType) {
        if (mimeType.startsWith('audio/')) contentType = 'audio'
        else if (mimeType.startsWith('video/')) contentType = 'video'
        else if (
            mimeType.startsWith('text/') ||
            mimeType === 'application/json' ||
            mimeType === 'application/xml'
        )
            contentType = 'text'
    }
    return { mimeType: fullMimeType, contentType }
}
