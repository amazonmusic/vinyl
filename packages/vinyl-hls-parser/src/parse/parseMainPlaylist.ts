/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringReader, substitute, ValidationError } from '@amazon/vinyl-util'
import type { AlternativeRendition } from '../types/AlternativeRendition'
import { renditionTypeValidator } from '../types/AlternativeRendition'
import type { MainPlaylist } from '../types/MainPlaylist'
import type { SessionData } from '../types/SessionData'
import type { VariantStream } from '../types/VariantStream'
import { HLS_VARIABLE_PATTERN } from './parseMediaPlaylist'
import { parseAttributes } from './parseAttributes'
import { readLine, skipWhitespaceLine, addIfPresent } from './parseUtil'

const EXTM3U = '#EXTM3U'
const EXT_X_STREAM_INF = '#EXT-X-STREAM-INF:'
const EXT_X_MEDIA = '#EXT-X-MEDIA:'
const EXT_X_SESSION_DATA = '#EXT-X-SESSION-DATA:'
const EXT_X_DEFINE = '#EXT-X-DEFINE:'

/**
 * Parses an HLS master playlist from M3U8 text.
 *
 * @param text The raw M3U8 manifest string.
 * @returns A readonly MainPlaylist structure.
 * @throws StringParseError if the manifest is malformed.
 */
export function parseMainPlaylist(text: string): MainPlaylist {
    const reader = new StringReader(text)

    reader.white()
    if (!reader.stringIf(EXTM3U)) {
        reader.err('Expected #EXTM3U')
    }
    // Advance past the rest of the #EXTM3U line
    readLine(reader)

    const variants: VariantStream[] = []
    const alternativeRenditions: AlternativeRendition[] = []
    const sessionData: SessionData[] = []
    const defines: Record<string, string> = {}

    while (reader.hasNext()) {
        if (skipWhitespaceLine(reader)) continue

        const line = readLine(reader)
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed.startsWith(EXT_X_STREAM_INF)) {
            const attrStr = trimmed.substring(EXT_X_STREAM_INF.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)

            // Next non-empty line is the URI
            let uri = ''
            while (reader.hasNext()) {
                if (skipWhitespaceLine(reader)) continue
                uri = readLine(reader).trim()
                break
            }

            variants.push(
                addIfPresent(
                    {
                        bandwidth: Number(attrs['BANDWIDTH']),
                        uri: substituteHlsVariables(uri, defines),
                        ...(attrs['FRAME-RATE'] && {
                            frameRate: Number(attrs['FRAME-RATE']),
                        }),
                        ...(attrs.RESOLUTION &&
                            parseResolution(attrs.RESOLUTION)),
                    },
                    attrs,
                    {
                        CODECS: 'codecs',
                        AUDIO: 'audioGroup',
                        VIDEO: 'videoGroup',
                        SUBTITLES: 'subtitlesGroup',
                        'CLOSED-CAPTIONS': 'closedCaptionsGroup',
                    }
                )
            )
        } else if (trimmed.startsWith(EXT_X_MEDIA)) {
            const attrStr = trimmed.substring(EXT_X_MEDIA.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)

            const type = attrs['TYPE']
            renditionTypeValidator.assert(type)

            if (attrs['URI']) {
                attrs['URI'] = substituteHlsVariables(attrs['URI'], defines)
            }

            alternativeRenditions.push(
                addIfPresent(
                    {
                        type,
                        groupId: attrs['GROUP-ID'],
                        name: attrs['NAME'],
                        ...(attrs['DEFAULT'] && {
                            default: attrs['DEFAULT'] === 'YES',
                        }),
                        ...(attrs['AUTOSELECT'] && {
                            autoSelect: attrs['AUTOSELECT'] === 'YES',
                        }),
                    },
                    attrs,
                    {
                        URI: 'uri',
                        LANGUAGE: 'language',
                    }
                )
            )
        } else if (trimmed.startsWith(EXT_X_SESSION_DATA)) {
            const attrStr = trimmed.substring(EXT_X_SESSION_DATA.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)

            sessionData.push(
                addIfPresent(
                    {
                        dataId: attrs['DATA-ID'],
                    },
                    attrs,
                    {
                        VALUE: 'value',
                        URI: 'uri',
                        LANGUAGE: 'language',
                    }
                )
            )
        } else if (trimmed.startsWith(EXT_X_DEFINE)) {
            const attrStr = trimmed.substring(EXT_X_DEFINE.length)
            const attrReader = new StringReader(attrStr)
            const attrs = parseAttributes(attrReader)
            if (attrs['NAME'] && attrs['VALUE']) {
                defines[attrs['NAME']] = attrs['VALUE']
            }
        }
        // Unrecognized tags and comments are silently skipped
    }

    return { variants, alternativeRenditions, sessionData, defines }
}

/**
 * Applies EXT-X-DEFINE variable substitution (per RFC 8216 §4.2) to a manifest
 * value, replacing `{$NAME}` tokens with the values declared earlier in the
 * playlist. Returns the input unchanged when no variables have been declared.
 */
function substituteHlsVariables(
    value: string,
    variables: Readonly<Record<string, string>>
): string {
    if (!value || Object.keys(variables).length === 0) return value
    return substitute(value, variables, HLS_VARIABLE_PATTERN)
}

/**
 * Parses a resolution string (e.g., "1920x1080") into width and height numbers.
 * Throws ValidationError for invalid formats per HLS spec.
 */
function parseResolution(resolution: string): {
    width: number
    height: number
} {
    const parts = resolution.split('x')
    if (parts.length !== 2) {
        throw new ValidationError(
            'Invalid resolution format, expected WIDTHxHEIGHT'
        )
    }

    const width = Number(parts[0])
    const height = Number(parts[1])

    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new ValidationError(
            'Invalid resolution values, width and height must be positive integers'
        )
    }

    return { width, height }
}
