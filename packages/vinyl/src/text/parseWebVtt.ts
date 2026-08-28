/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, type Mutable, ValidationError } from '@amazon/vinyl-util'
import type { VttCueStyle } from './VttCueStyle'

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

    /**
     * The authored cue settings from the timing line (position/line/size/
     * align/vertical), when any were present. Preserved so a renderer can
     * position the cue faithfully. Absent when the cue declared no settings.
     */
    readonly settings?: VttCueStyle
}

/**
 * The result of parsing a WebVTT document.
 */
export interface WebVttDocument {
    /**
     * Parsed cues in document order.
     */
    readonly cues: readonly WebVttCue[]

    /**
     * The raw CSS body of each `STYLE` block, in document order. These carry
     * `::cue` rules (e.g. `::cue(.loud) { font-weight: bold }`) an HTML renderer
     * can apply. Empty when the document declared no styles.
     */
    readonly styles: readonly string[]
}

const WEBVTT_HEADER = 'WEBVTT'

// A single WebVTT timestamp anchored at the start: `[ hours ":" ] minutes ":"
// seconds "." ms`, with hours two-or-more digits (optional), minutes/seconds
// two digits in 0-59, and milliseconds three digits (per the spec's "collect a
// WebVTT timestamp"). Timestamp collection stops after the milliseconds — it is
// NOT anchored at the end — so the start match must be checked to consume its
// whole (pre-`-->`) token, while for the end match any remainder is cue
// settings. The only unbounded quantifier is `\d+`, followed by a literal `:`
// (no nested/overlapping quantifiers), so it matches in linear time, and it
// only ever runs against a single short token — backtracking is a non-issue.
const TIMESTAMP_RE = /^(?:(\d+):)?([0-5]\d):([0-5]\d)\.(\d{3})/

/**
 * Parses a WebVTT document into a list of cues.
 *
 * Implements a forgiving subset of the WebVTT 1.0 specification: header
 * detection, comment blocks (lines starting with `NOTE`), styling/region
 * blocks (STYLE bodies are captured, REGION skipped), cue identifiers, and
 * HH:MM:SS.mmm or MM:SS.mmm timestamps with optional cue settings.
 *
 * @param input The raw WebVTT document text. Both LF and CRLF line endings
 * are supported, and a leading BOM is stripped if present.
 * @throws ValidationError if the input is missing the WEBVTT header.
 * @see https://www.w3.org/TR/webvtt1/#webvtt-timestamp
 */
export function parseWebVtt(input: string): WebVttDocument {
    if (typeof input !== 'string') {
        throw new ValidationError(
            'WebVTT input must be a string',
            ErrorOrigin.MEDIA
        )
    }
    let text = input
    // Strip a leading BOM, then normalize line endings.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const lines = text.split(/\r\n|\r|\n/)

    if (lines.length === 0 || !isWebVttHeader(lines[0])) {
        throw new ValidationError(
            'WebVTT must begin with a WEBVTT header',
            ErrorOrigin.MEDIA
        )
    }

    const cues: WebVttCue[] = []
    const styles: string[] = []
    // Per the WebVTT spec, everything from the `WEBVTT` signature up to (and
    // including) the first blank line is the file header — metadata lines (e.g.
    // HLS's `X-TIMESTAMP-MAP=...`) belong in that block and MUST NOT be
    // interpreted as cue content.
    let i = 1
    while (i < lines.length && lines[i] !== '') i++

    while (i < lines.length) {
        // Skip blank lines between blocks.
        if (lines[i] === '') {
            i++
            continue
        }
        // NOTE comment / REGION blocks: skip until the blank line. A NOTE line
        // is `NOTE` alone or `NOTE` followed by whitespace (space or tab).
        if (
            lines[i] === 'NOTE' ||
            lines[i].startsWith('NOTE ') ||
            lines[i].startsWith('NOTE\t') ||
            lines[i] === 'REGION'
        ) {
            i++
            while (i < lines.length && lines[i] !== '') i++
            continue
        }
        // STYLE block: capture its CSS body (up to the blank line).
        if (lines[i] === 'STYLE') {
            i++
            const start = i
            while (i < lines.length && lines[i] !== '') i++
            const css = lines.slice(start, i).join('\n').trim()
            if (css) styles.push(css)
            continue
        }

        // Cue: an optional identifier line, then a timing line, then payload.
        // A cue identifier never contains `-->`, so a line without it is the
        // identifier and the timing line follows (spec: "collect a WebVTT
        // block").
        let id: string | null = null
        if (!lines[i].includes('-->')) {
            id = lines[i]
            i++
            if (i >= lines.length) break // identifier with no timing line
        }
        const timing = parseTiming(lines[i])
        i++
        if (!timing) {
            // Malformed timing line: drain to the next blank line.
            while (i < lines.length && lines[i] !== '') i++
            continue
        }

        const payloadLines: string[] = []
        while (i < lines.length && lines[i] !== '') {
            payloadLines.push(lines[i])
            i++
        }
        const text = payloadLines.join('\n')
        // Omit the optional `settings` key entirely when there are none.
        cues.push(
            timing.settings === undefined
                ? {
                      id,
                      startTime: timing.startTime,
                      endTime: timing.endTime,
                      text,
                  }
                : {
                      id,
                      startTime: timing.startTime,
                      endTime: timing.endTime,
                      text,
                      settings: timing.settings,
                  }
        )
    }

    return { cues, styles }
}

/**
 * Parses a WebVTT timing line ("start --> end settings"), returning the two
 * times (in seconds) and any parsed cue settings, or null if it is not a valid
 * timing line. Splitting on the literal `-->` (and on the whitespace before the
 * settings) keeps each timestamp match a fixed, anchored token.
 */
function parseTiming(line: string): {
    startTime: number
    endTime: number
    settings: VttCueStyle | undefined
} | null {
    const arrow = line.indexOf('-->')
    if (arrow < 0) return null
    // Before the arrow: only the start timestamp (whitespace-trimmed), so the
    // match must consume the whole token.
    const before = line.slice(0, arrow).trim()
    const start = TIMESTAMP_RE.exec(before)
    if (!start || start[0].length !== before.length) return null
    // After the arrow: the end timestamp, then whatever follows is cue settings.
    const rest = line.slice(arrow + 3).trim()
    const end = TIMESTAMP_RE.exec(rest)
    if (!end) return null
    return {
        startTime: toSeconds(start[1], start[2], start[3], start[4]),
        endTime: toSeconds(end[1], end[2], end[3], end[4]),
        settings: parseCueSettings(rest.slice(end[0].length)),
    }
}

function toSeconds(
    hours: string | undefined,
    minutes: string,
    seconds: string,
    millis: string
): number {
    return (
        (hours ? Number(hours) * 3600 : 0) +
        Number(minutes) * 60 +
        Number(seconds) +
        Number(millis) / 1000
    )
}

function isWebVttHeader(line: string): boolean {
    if (!line.startsWith(WEBVTT_HEADER)) return false
    if (line.length === WEBVTT_HEADER.length) return true
    const next = line.charCodeAt(WEBVTT_HEADER.length)
    // Header may be followed by space, tab, or any text after a separator.
    return next === 0x20 || next === 0x09
}

const ALIGN = new Set(['start', 'center', 'end', 'left', 'right'])
const LINE_ALIGN = new Set(['start', 'center', 'end'])
const POSITION_ALIGN = new Set(['line-left', 'center', 'line-right', 'auto'])
const VERTICAL = new Set(['rl', 'lr'])

/**
 * Parses the cue-settings tail of a timing line (e.g.
 * `align:center line:80% position:50%,center size:90% vertical:rl`) into a
 * {@link VttCueStyle}. Unknown keys and malformed values are skipped; returns
 * undefined when nothing valid was found.
 */
function parseCueSettings(text: string | undefined): VttCueStyle | undefined {
    if (!text) return undefined
    const settings: Mutable<VttCueStyle> = {}
    for (const token of text.trim().split(/\s+/)) {
        const colon = token.indexOf(':')
        if (colon <= 0) continue
        const key = token.slice(0, colon)
        const value = token.slice(colon + 1)
        switch (key) {
            case 'align': {
                // 'middle' is the legacy spelling of 'center'.
                const align = value === 'middle' ? 'center' : value
                if (ALIGN.has(align)) settings.align = align as AlignSetting
                break
            }
            case 'vertical':
                if (VERTICAL.has(value))
                    settings.vertical = value as DirectionSetting
                break
            case 'size': {
                const size = parsePercent(value)
                if (size != null) settings.size = size
                break
            }
            case 'line':
                parseLine(value, settings)
                break
            case 'position':
                parsePosition(value, settings)
                break
        }
    }
    return Object.keys(settings).length > 0 ? settings : undefined
}

function parseLine(value: string, settings: Mutable<VttCueStyle>): void {
    const [pos, align] = value.split(',') as [string, string?]
    if (pos.endsWith('%')) {
        const percent = parsePercent(pos)
        if (percent == null) return
        settings.line = percent
        settings.snapToLines = false
    } else {
        const n = Number(pos)
        if (!Number.isInteger(n)) return
        settings.line = n
        settings.snapToLines = true
    }
    const lineAlign = align === 'middle' ? 'center' : align
    if (lineAlign && LINE_ALIGN.has(lineAlign))
        settings.lineAlign = lineAlign as LineAlignSetting
}

function parsePosition(value: string, settings: Mutable<VttCueStyle>): void {
    const [pos, align] = value.split(',') as [string, string?]
    const percent = parsePercent(pos)
    if (percent == null) return
    settings.position = percent
    const positionAlign = align === 'middle' ? 'center' : align
    if (positionAlign && POSITION_ALIGN.has(positionAlign))
        settings.positionAlign = positionAlign as PositionAlignSetting
}

/** Parses an `N%` token to its numeric percentage, or null when malformed. */
function parsePercent(value: string): number | null {
    if (!value.endsWith('%')) return null
    const n = Number(value.slice(0, -1))
    return Number.isFinite(n) ? n : null
}
