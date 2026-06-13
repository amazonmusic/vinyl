/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'

/**
 * A single WebVTT cue.
 *
 * @see https://www.w3.org/TR/webvtt1/
 */
export interface WebVttCue {
    /**
     * Optional cue identifier, the line that appears before the timing line.
     */
    readonly id: string | null

    /**
     * Cue start time in seconds.
     */
    readonly startTime: number

    /**
     * Cue end time in seconds.
     */
    readonly endTime: number

    /**
     * The cue text payload, with line breaks preserved as `\n`.
     */
    readonly text: string
}

/**
 * The result of parsing a WebVTT document.
 */
export interface WebVttDocument {
    /**
     * Parsed cues in document order.
     */
    readonly cues: readonly WebVttCue[]
}

const WEBVTT_HEADER = 'WEBVTT'

// Trailing cue settings are tolerated but ignored. They are separated from the
// end timestamp by whitespace, so the tail is matched as an optional group that
// begins with a whitespace character. Using `(?:\s.*)?$` rather than `\s*(.*)$`
// avoids the ambiguous overlap between `\s*` and `.*` (both match spaces), which
// would allow polynomial backtracking on space-heavy input.
const TIME_RE =
    /^\s*(?:(\d+):)?([0-5]?\d):([0-5]?\d)\.(\d{3})\s*-->\s*(?:(\d+):)?([0-5]?\d):([0-5]?\d)\.(\d{3})(?:\s.*)?$/

/**
 * Parses a WebVTT document into a list of cues.
 *
 * Implements a forgiving subset of the WebVTT 1.0 specification: header
 * detection, comment blocks (lines starting with `NOTE`), styling/region
 * blocks (skipped), cue identifiers, and HH:MM:SS.mmm or MM:SS.mmm timestamps.
 * Cue settings on the timing line are tolerated and ignored.
 *
 * @param input The raw WebVTT document text. Both LF and CRLF line endings
 * are supported, and a leading BOM is stripped if present.
 * @throws ValidationError if the input is missing the WEBVTT header.
 */
export function parseWebVtt(input: string): WebVttDocument {
    if (typeof input !== 'string') {
        throw new ValidationError(
            'WebVTT input must be a string',
            ErrorOrigin.MEDIA
        )
    }
    let text = input
    // Strip BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    // Normalize line endings
    const lines = text.split(/\r\n|\r|\n/)

    if (lines.length === 0 || !isWebVttHeader(lines[0])) {
        throw new ValidationError(
            'WebVTT must begin with a WEBVTT header',
            ErrorOrigin.MEDIA
        )
    }

    const cues: WebVttCue[] = []
    // Per the WebVTT spec, everything from the `WEBVTT` signature up to (and
    // including) the first blank line is the file header — any metadata
    // header lines (e.g. HLS's `X-TIMESTAMP-MAP=...`) belong in that block
    // and MUST NOT be interpreted as cue content.
    let i = 1
    while (i < lines.length && lines[i] !== '') i++

    while (i < lines.length) {
        // Skip empty lines between blocks.
        if (lines[i] === '') {
            i++
            continue
        }
        // NOTE comment block: skip until blank line.
        if (lines[i] === 'NOTE' || lines[i].startsWith('NOTE ')) {
            i++
            while (i < lines.length && lines[i] !== '') i++
            continue
        }
        // STYLE / REGION blocks - skip until blank line.
        if (lines[i] === 'STYLE' || lines[i] === 'REGION') {
            i++
            while (i < lines.length && lines[i] !== '') i++
            continue
        }

        // Cue: optional identifier, then a timing line, then payload.
        let id: string | null = null
        let timingLine: string
        const firstLine = lines[i]
        if (TIME_RE.test(firstLine)) {
            timingLine = firstLine
            i++
        } else {
            id = firstLine
            i++
            if (i >= lines.length) break
            timingLine = lines[i]
            i++
        }

        const match = TIME_RE.exec(timingLine)
        if (!match) {
            // Skip malformed cue: drain to next blank line.
            while (i < lines.length && lines[i] !== '') i++
            continue
        }

        const startTime = toSeconds(match[1], match[2], match[3], match[4])
        const endTime = toSeconds(match[5], match[6], match[7], match[8])

        const payloadLines: string[] = []
        while (i < lines.length && lines[i] !== '') {
            payloadLines.push(lines[i])
            i++
        }

        cues.push({
            id,
            startTime,
            endTime,
            text: payloadLines.join('\n'),
        })
    }

    return { cues }
}

function isWebVttHeader(line: string): boolean {
    if (!line.startsWith(WEBVTT_HEADER)) return false
    if (line.length === WEBVTT_HEADER.length) return true
    const next = line.charCodeAt(WEBVTT_HEADER.length)
    // Header may be followed by space, tab, or any text after a separator.
    return next === 0x20 || next === 0x09
}

function toSeconds(
    hours: string | undefined,
    minutes: string,
    seconds: string,
    millis: string
): number {
    const h = hours ? Number(hours) : 0
    const m = Number(minutes)
    const s = Number(seconds)
    const ms = Number(millis)
    return h * 3600 + m * 60 + s + ms / 1000
}
