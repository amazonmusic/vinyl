/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'
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

/** Mutable builder for the cue settings accumulated while parsing. */
type MutableCueStyle = {
    -readonly [K in keyof VttCueStyle]?: VttCueStyle[K]
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

// Trailing cue settings are captured (group 9) for the renderer. They are
// separated from the end timestamp by whitespace, so the tail is an optional
// group beginning with a whitespace run. `(?:\s+(.*))?$` (a single `\s+` then a
// non-nested `.*`) avoids the polynomial backtracking a `\s*(.*)$` overlap would
// allow on space-heavy input.
const TIME_RE =
    /^\s*(?:(\d+):)?([0-5]?\d):([0-5]?\d)\.(\d{3})\s*-->\s*(?:(\d+):)?([0-5]?\d):([0-5]?\d)\.(\d{3})(?:\s+(.*))?$/

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
    const styles: string[] = []
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
        // STYLE block: capture its CSS body (up to the blank line).
        if (lines[i] === 'STYLE') {
            i++
            const start = i
            while (i < lines.length && lines[i] !== '') i++
            const css = lines.slice(start, i).join('\n').trim()
            if (css) styles.push(css)
            continue
        }
        // REGION blocks - skip until blank line.
        if (lines[i] === 'REGION') {
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
        const settings = parseCueSettings(match[9])

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
            ...(settings && { settings }),
        })
    }

    return { cues, styles }
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
    const settings: MutableCueStyle = {}
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

function parseLine(value: string, settings: MutableCueStyle): void {
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

function parsePosition(value: string, settings: MutableCueStyle): void {
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
