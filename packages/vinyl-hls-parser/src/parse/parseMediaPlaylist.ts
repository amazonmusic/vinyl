/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringReader, substitute } from '@amazon/vinyl-util'
import type { EncryptionKey } from '../types/EncryptionKey'
import { encryptionMethodValidator } from '../types/EncryptionKey'
import type { HlsSegment, HlsMap } from '../types/HlsSegment'
import type { MediaPlaylist } from '../types/MediaPlaylist'
import { parseAttributes } from './parseAttributes'
import { readLine, skipWhitespaceLine, addIfPresent } from './parseUtil'

export const HLS_VARIABLE_PATTERN = /\{\$([^}]+)}/g

const EXTM3U = '#EXTM3U'
const EXTINF = '#EXTINF:'
const EXT_X_TARGETDURATION = '#EXT-X-TARGETDURATION:'
const EXT_X_MEDIA_SEQUENCE = '#EXT-X-MEDIA-SEQUENCE:'
const EXT_X_ENDLIST = '#EXT-X-ENDLIST'
const EXT_X_PLAYLIST_TYPE = '#EXT-X-PLAYLIST-TYPE:'
const EXT_X_VERSION = '#EXT-X-VERSION:'
const EXT_X_KEY = '#EXT-X-KEY:'
const EXT_X_BYTERANGE = '#EXT-X-BYTERANGE:'
const EXT_X_DISCONTINUITY = '#EXT-X-DISCONTINUITY'
const EXT_X_PROGRAM_DATE_TIME = '#EXT-X-PROGRAM-DATE-TIME:'
const EXT_X_MAP = '#EXT-X-MAP:'
const EXT_X_DEFINE = '#EXT-X-DEFINE:'

/**
 * Parses an HLS media playlist from M3U8 text.
 *
 * @param text The raw M3U8 manifest string.
 * @param variables Optional variable definitions from the parent multivariant
 *   playlist's #EXT-X-DEFINE tags. Media-playlist `#EXT-X-DEFINE:IMPORT="name"`
 *   entries resolve against this map. Local `#EXT-X-DEFINE:NAME=,VALUE=`
 *   entries are also supported and take precedence.
 * @returns A readonly MediaPlaylist structure.
 * @throws StringParseError if the manifest is malformed.
 */
export function parseMediaPlaylist(
    text: string,
    variables?: Readonly<Record<string, string>>
): MediaPlaylist {
    const defines: Record<string, string> = { ...(variables ?? {}) }
    const substituteVars = (v: string): string =>
        Object.keys(defines).length === 0
            ? v
            : substitute(v, defines, HLS_VARIABLE_PATTERN)

    const reader = new StringReader(text)

    reader.white()
    if (!reader.stringIf(EXTM3U)) {
        reader.err('Expected #EXTM3U')
    }
    readLine(reader)

    let version = 1
    let targetDuration = 0
    let mediaSequence = 0
    let playlistType: 'VOD' | 'EVENT' | 'LIVE' = 'LIVE'
    let ended = false

    let currentKey: EncryptionKey | undefined
    let currentMap: HlsMap | undefined
    let pendingByteRange: { length: number; offset: number } | undefined
    let pendingDiscontinuity = false
    let pendingDateTime: string | undefined

    const segments: HlsSegment[] = []
    let sequenceCounter = 0

    while (reader.hasNext()) {
        if (skipWhitespaceLine(reader)) continue

        const line = readLine(reader)
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed.startsWith(EXTINF)) {
            const durationStr = trimmed.substring(EXTINF.length).split(',')[0]
            const duration = Number(durationStr)

            // Find the URI, skipping any tags that come between EXTINF and URI
            let uri = ''
            while (reader.hasNext()) {
                if (skipWhitespaceLine(reader)) continue
                const nextLine = readLine(reader).trim()
                if (!nextLine.startsWith('#')) {
                    uri = substituteVars(nextLine)
                    break
                }
                // Process tags that come between EXTINF and URI
                if (nextLine.startsWith(EXT_X_BYTERANGE)) {
                    const rangeStr = nextLine.substring(EXT_X_BYTERANGE.length)
                    pendingByteRange = parseByteRangeString(rangeStr)
                } else if (nextLine === EXT_X_DISCONTINUITY) {
                    pendingDiscontinuity = true
                } else if (nextLine.startsWith(EXT_X_PROGRAM_DATE_TIME)) {
                    pendingDateTime = nextLine.substring(
                        EXT_X_PROGRAM_DATE_TIME.length
                    )
                } else if (nextLine.startsWith(EXT_X_MAP)) {
                    const attrStr = nextLine.substring(EXT_X_MAP.length)
                    const attrReader = new StringReader(attrStr)
                    const attrs = parseAttributes(attrReader)
                    const mapUri = attrs['URI']
                    if (mapUri) {
                        const byteRangeStr = attrs['BYTERANGE']
                        currentMap = {
                            uri: mapUri,
                            ...(byteRangeStr && {
                                byteRange: parseByteRangeString(byteRangeStr),
                            }),
                        }
                    }
                }
            }

            segments.push({
                uri,
                duration,
                sequenceNumber: mediaSequence + sequenceCounter,
                ...(currentKey && { key: currentKey }),
                ...(currentMap && { map: currentMap }),
                ...(pendingByteRange && { byteRange: pendingByteRange }),
                discontinuity: pendingDiscontinuity,
                ...(pendingDateTime && { programDateTime: pendingDateTime }),
            })

            sequenceCounter++
            pendingByteRange = undefined
            pendingDiscontinuity = false
            pendingDateTime = undefined
        } else if (trimmed.startsWith(EXT_X_TARGETDURATION)) {
            targetDuration = Number(
                trimmed.substring(EXT_X_TARGETDURATION.length)
            )
        } else if (trimmed.startsWith(EXT_X_MEDIA_SEQUENCE)) {
            mediaSequence = Number(
                trimmed.substring(EXT_X_MEDIA_SEQUENCE.length)
            )
        } else if (trimmed === EXT_X_ENDLIST) {
            ended = true
        } else if (trimmed.startsWith(EXT_X_PLAYLIST_TYPE)) {
            const val = trimmed.substring(EXT_X_PLAYLIST_TYPE.length).trim()
            if (val === 'VOD' || val === 'EVENT') {
                playlistType = val
            }
        } else if (trimmed.startsWith(EXT_X_VERSION)) {
            version = Number(trimmed.substring(EXT_X_VERSION.length))
        } else if (trimmed.startsWith(EXT_X_KEY)) {
            const attrStr = trimmed.substring(EXT_X_KEY.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)

            const method = attrs['METHOD']
            encryptionMethodValidator.assert(method)

            currentKey = addIfPresent(
                {
                    method,
                },
                attrs,
                {
                    URI: 'uri',
                    IV: 'iv',
                    KEYFORMAT: 'keyFormat',
                    KEYFORMATVERSIONS: 'keyFormatVersions',
                }
            )
        } else if (trimmed.startsWith(EXT_X_MAP)) {
            const attrStr = trimmed.substring(EXT_X_MAP.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)

            const mapUri = attrs['URI']
            if (mapUri) {
                const byteRangeStr = attrs['BYTERANGE']
                currentMap = {
                    uri: mapUri,
                    ...(byteRangeStr && {
                        byteRange: parseByteRangeString(byteRangeStr),
                    }),
                }
            }
        } else if (trimmed.startsWith(EXT_X_BYTERANGE)) {
            const rangeStr = trimmed.substring(EXT_X_BYTERANGE.length)
            pendingByteRange = parseByteRangeString(rangeStr)
        } else if (trimmed === EXT_X_DISCONTINUITY) {
            pendingDiscontinuity = true
        } else if (trimmed.startsWith(EXT_X_PROGRAM_DATE_TIME)) {
            pendingDateTime = trimmed.substring(EXT_X_PROGRAM_DATE_TIME.length)
        } else if (trimmed.startsWith(EXT_X_DEFINE)) {
            const attrStr = trimmed.substring(EXT_X_DEFINE.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)
            const importName = attrs['IMPORT']
            if (importName) {
                // Per RFC 8216 §4.4.2.3: IMPORT copies the value from the
                // parent multivariant's DEFINE map. Ignore silently if unknown.
                const imported = variables?.[importName]
                if (imported !== undefined) defines[importName] = imported
            } else if (attrs['NAME'] && attrs['VALUE']) {
                defines[attrs['NAME']] = attrs['VALUE']
            }
        }
        // Unrecognized tags and comments are silently skipped
    }

    return {
        version,
        targetDuration,
        mediaSequence,
        playlistType,
        ended,
        segments,
    }
}

/**
 * Parses a byte range string (e.g. "1000@500" or "1000") into length and offset.
 */
function parseByteRangeString(str: string): {
    length: number
    offset: number
} {
    const parts = str.split('@')
    return {
        length: Number(parts[0]),
        offset: parts.length > 1 ? Number(parts[1]) : 0,
    }
}
