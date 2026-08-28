/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseWebVtt } from '@amazon/vinyl'
import { ValidationError } from '@amazon/vinyl-util'

describe('parseWebVtt', () => {
    it('parses a minimal cue', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.500
Hello world`
        const doc = parseWebVtt(text)
        expect(doc.cues).toEqual([
            {
                id: null,
                startTime: 1,
                endTime: 2.5,
                text: 'Hello world',
            },
        ])
    })

    it('parses a cue identifier', () => {
        const text = `WEBVTT

cue-1
00:00:01.000 --> 00:00:02.000
text payload`
        expect(parseWebVtt(text).cues).toEqual([
            {
                id: 'cue-1',
                startTime: 1,
                endTime: 2,
                text: 'text payload',
            },
        ])
    })

    it('parses multiple cues with multi-line text', () => {
        const text = `WEBVTT

00:00:00.500 --> 00:00:01.000
line one
line two

00:00:01.000 --> 00:00:02.000
second cue`
        expect(parseWebVtt(text).cues).toEqual([
            {
                id: null,
                startTime: 0.5,
                endTime: 1,
                text: 'line one\nline two',
            },
            {
                id: null,
                startTime: 1,
                endTime: 2,
                text: 'second cue',
            },
        ])
    })

    it('parses MM:SS.mmm timestamps without an hours field', () => {
        const text = `WEBVTT

10:30.500 --> 11:45.250
brief`
        const cue = parseWebVtt(text).cues[0]
        expect(cue.startTime).toBeCloseTo(630.5, 6)
        expect(cue.endTime).toBeCloseTo(705.25, 6)
    })

    it('parses HH:MM:SS.mmm timestamps', () => {
        const text = `WEBVTT

01:02:03.400 --> 01:02:04.500
deep`
        const cue = parseWebVtt(text).cues[0]
        expect(cue.startTime).toBeCloseTo(3723.4, 6)
        expect(cue.endTime).toBeCloseTo(3724.5, 6)
    })

    it('strips a UTF-8 BOM', () => {
        const text = '﻿WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx'
        expect(parseWebVtt(text).cues.length).toBe(1)
    })

    it('accepts CRLF line endings', () => {
        const text = `WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\ncrlf`
        expect(parseWebVtt(text).cues[0].text).toBe('crlf')
    })

    it('skips NOTE blocks', () => {
        const text = `WEBVTT

NOTE this is a comment
that spans multiple lines

00:00:01.000 --> 00:00:02.000
hello`
        const doc = parseWebVtt(text)
        expect(doc.cues.length).toBe(1)
        expect(doc.cues[0].text).toBe('hello')
    })

    it('skips standalone NOTE block', () => {
        const text = `WEBVTT

NOTE
single line note

00:00:01.000 --> 00:00:02.000
ok`
        const doc = parseWebVtt(text)
        expect(doc.cues.length).toBe(1)
    })

    it('captures STYLE block CSS while still parsing cues', () => {
        const text = `WEBVTT

STYLE
::cue(.loud) { font-weight: bold }

STYLE
::cue { color: red }

00:00:01.000 --> 00:00:02.000
styled`
        const doc = parseWebVtt(text)
        expect(doc.cues.length).toBe(1)
        expect(doc.styles).toEqual([
            '::cue(.loud) { font-weight: bold }',
            '::cue { color: red }',
        ])
    })

    it('reports no styles when there are no STYLE blocks', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000
x`
        expect(parseWebVtt(text).styles).toEqual([])
    })

    it('skips REGION blocks', () => {
        const text = `WEBVTT

REGION
id:fred
width:40%

00:00:01.000 --> 00:00:02.000
regional`
        const doc = parseWebVtt(text)
        expect(doc.cues.length).toBe(1)
        expect(doc.styles).toEqual([])
    })

    it('parses cue settings on the timing line', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000 line:50% align:start
positioned`
        const cue = parseWebVtt(text).cues[0]
        expect(cue.text).toBe('positioned')
        expect(cue.settings).toEqual({
            line: 50,
            snapToLines: false,
            align: 'start',
        })
    })

    it('parses integer/negative lines as snap-to-lines, with lineAlign', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000 line:-3,end
a

00:00:03.000 --> 00:00:04.000 line:5
b`
        const [a, b] = parseWebVtt(text).cues
        expect(a.settings).toEqual({
            line: -3,
            snapToLines: true,
            lineAlign: 'end',
        })
        expect(b.settings).toEqual({ line: 5, snapToLines: true })
    })

    it("maps the legacy 'middle' keyword to 'center'", () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000 align:middle line:85%,middle position:50%,middle
a`
        expect(parseWebVtt(text).cues[0].settings).toEqual({
            align: 'center',
            line: 85,
            snapToLines: false,
            lineAlign: 'center',
            position: 50,
            positionAlign: 'center',
        })
    })

    it('parses position (with align), size and vertical', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000 position:20%,line-left size:80% vertical:rl
a`
        expect(parseWebVtt(text).cues[0].settings).toEqual({
            position: 20,
            positionAlign: 'line-left',
            size: 80,
            vertical: 'rl',
        })
    })

    it('omits settings and skips malformed/unknown tokens', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000
plain

00:00:03.000 --> 00:00:04.000 align:bogus size:oops region:foo bareword
b`
        const [plain, b] = parseWebVtt(text).cues
        expect(plain.settings).toBeUndefined()
        // align invalid, size not a %, unknown key, and a colon-less token.
        expect(b.settings).toBeUndefined()
    })

    it('skips malformed line/position/percent values and invalid aligns', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000 line:x% size:y%
a

00:00:03.000 --> 00:00:04.000 line:1.5 position:bad
b

00:00:05.000 --> 00:00:06.000 line:5,bogus position:20%,nope
c`
        const [a, b, c] = parseWebVtt(text).cues
        expect(a.settings).toBeUndefined() // non-numeric percentages → dropped
        expect(b.settings).toBeUndefined() // non-integer line, non-% position
        // Valid values kept; invalid *Align keywords dropped.
        expect(c.settings).toEqual({
            line: 5,
            snapToLines: true,
            position: 20,
        })
    })

    it('skips a malformed cue and continues', () => {
        const text = `WEBVTT

00:00:01.000 --> NOT-A-TIME
broken cue
should be skipped

00:00:02.000 --> 00:00:03.000
good`
        const cues = parseWebVtt(text).cues
        expect(cues.length).toBe(1)
        expect(cues[0].text).toBe('good')
    })

    it('skips a line with --> but an invalid start timestamp', () => {
        const text = `WEBVTT

BForced --> 00:00:02.000
skipped

00:00:02.000 --> 00:00:03.000
good`
        const cues = parseWebVtt(text).cues
        expect(cues.length).toBe(1)
        expect(cues[0].text).toBe('good')
    })

    it('ignores unparseable text glued after the end timestamp', () => {
        // Per the spec, timestamp collection stops after the milliseconds; any
        // trailing text is parsed as (here, invalid, ignored) cue settings.
        const cue = parseWebVtt(
            'WEBVTT\n\n00:00:01.000 --> 00:00:02.000x\ntext'
        ).cues[0]
        expect(cue.endTime).toBe(2)
        expect(cue.settings).toBeUndefined()
        expect(cue.text).toBe('text')
    })

    it('parses multi-digit hours (spec allows two or more)', () => {
        const cues = parseWebVtt(
            'WEBVTT\n\n100:00:01.000 --> 100:00:02.500\nhi'
        ).cues
        expect(cues.length).toBe(1)
        expect(cues[0].startTime).toBe(360001)
        expect(cues[0].endTime).toBe(360002.5)
    })

    it('treats consecutive blank lines between cues as separators', () => {
        const text =
            'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\none\n\n\n' +
            '00:00:03.000 --> 00:00:04.000\ntwo'
        expect(parseWebVtt(text).cues.map((c) => c.text)).toEqual([
            'one',
            'two',
        ])
    })

    // Each line exercises a distinct timestamp-parser rejection branch; all are
    // treated as a (dropped) identifier so only the trailing valid cue survives.
    for (const timing of [
        '12 --> 00:00:02.000', // two digits then no ':'
        '7 --> 00:00:02.000', // one digit then no second digit
        '00:00:01.000 00:00:02.000', // no --> ⇒ treated as an identifier
        '5:30.000 --> 00:00:02.000', // MM:SS minutes not two digits
        '75:30.000 --> 00:00:02.000', // MM:SS minutes > 59
        '12:34 --> 00:00:02.000', // seconds not terminated by '.'
        '00:99:00.000 --> 00:00:02.000', // HH:MM:SS minutes > 59
        '00:00:99.000 --> 00:00:02.000', // HH:MM:SS seconds > 59
        '00:00:0.400 --> 00:00:02.000', // HH:MM:SS seconds not two digits
        '12:3:45.000 --> 00:00:02.000', // minutes not two digits before ':'
        '00:00:00 --> 00:00:02.000', // HH:MM:SS missing .mmm
        '00:00:00.00 --> 00:00:02.000', // milliseconds only two digits
        '00:00.0 --> 00:00:02.000', // milliseconds only one digit
        '00:00. --> 00:00:02.000', // milliseconds missing
        '12:ab --> 00:00:02.000', // non-digit minute/second
        '00:00:01.0', // truncated timestamp at end of input
    ]) {
        it(`skips a line with an invalid timestamp: "${timing}"`, () => {
            const text = `WEBVTT\n\n${timing}\nfiller\n\n00:00:05.000 --> 00:00:06.000\nok`
            expect(parseWebVtt(text).cues.map((c) => c.text)).toEqual(['ok'])
        })
    }

    // Keyword prefixes (NOTES/REGIONAL/STYLES) are ordinary cue identifiers, not
    // NOTE/REGION/STYLE blocks — this also exercises each keyword's fall-through.
    for (const identifier of ['NOTES', 'REGIONAL', 'STYLES']) {
        it(`treats keyword prefix "${identifier}" as an identifier`, () => {
            const cues = parseWebVtt(
                `WEBVTT\n\n${identifier}\n00:00:01.000 --> 00:00:02.000\nhi`
            ).cues
            expect(cues.length).toBe(1)
            expect(cues[0].id).toBe(identifier)
        })
    }

    it('normalizes CRLF line endings and splits CRLF-separated cues', () => {
        const text =
            'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nline one\r\nline two' +
            '\r\n\r\n00:00:03.000 --> 00:00:04.000\r\nsecond'
        expect(parseWebVtt(text).cues.map((c) => c.text)).toEqual([
            'line one\nline two',
            'second',
        ])
    })

    it('accepts a NOTE block at end of input', () => {
        expect(parseWebVtt('WEBVTT\n\nNOTE').cues).toEqual([])
    })

    it('handles input that ends mid-timestamp', () => {
        expect(parseWebVtt('WEBVTT\n\n00:00:00.000 --> 00:00:0').cues).toEqual(
            []
        )
    })

    it('returns empty cues on header-only input', () => {
        expect(parseWebVtt('WEBVTT\n').cues).toEqual([])
    })

    it('throws on missing header', () => {
        expect(() => parseWebVtt('not a vtt file')).toThrowMatching((e) => {
            return e instanceof ValidationError
        })
    })

    it('throws on non-string input', () => {
        expect(() =>
            parseWebVtt(undefined as unknown as string)
        ).toThrowMatching((e) => e instanceof ValidationError)
    })

    it('accepts header followed by extra description', () => {
        const text = `WEBVTT - English subtitles

00:00:01.000 --> 00:00:02.000
hi`
        expect(parseWebVtt(text).cues.length).toBe(1)
    })

    it('accepts header followed by tab', () => {
        const text = `WEBVTT\t\n\n00:00:01.000 --> 00:00:02.000\nhi`
        expect(parseWebVtt(text).cues.length).toBe(1)
    })

    it('skips an HLS X-TIMESTAMP-MAP header line', () => {
        // HLS captions place `X-TIMESTAMP-MAP=...` in the WebVTT header (per
        // RFC 8216 §3.5). Without recognizing this as part of the header, the
        // first cue in every segment gets consumed as a malformed identifier.
        const text = `WEBVTT
X-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000

00:00:00.250 --> 00:00:00.879
Welcome,

00:00:01.000 --> 00:00:02.000
hi`
        const cues = parseWebVtt(text).cues
        expect(cues.length).toBe(2)
        expect(cues[0].text).toBe('Welcome,')
        expect(cues[1].text).toBe('hi')
    })

    it('skips WebVTT metadata header lines', () => {
        // Metadata headers of the form `Name: value` between the signature
        // and the first blank line are part of the file header.
        const text = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:02.000
hi`
        const cues = parseWebVtt(text).cues
        expect(cues.length).toBe(1)
        expect(cues[0].text).toBe('hi')
    })

    it('handles trailing identifier without timing line', () => {
        // Identifier with no following timing line - cue is dropped, parser
        // breaks out cleanly without throwing.
        const text = `WEBVTT

trailing-id`
        expect(parseWebVtt(text).cues).toEqual([])
    })
})
