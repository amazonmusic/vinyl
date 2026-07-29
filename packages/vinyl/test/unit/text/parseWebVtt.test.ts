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

    it('skips STYLE blocks', () => {
        const text = `WEBVTT

STYLE
::cue { color: red; }

00:00:01.000 --> 00:00:02.000
styled`
        expect(parseWebVtt(text).cues.length).toBe(1)
    })

    it('skips REGION blocks', () => {
        const text = `WEBVTT

REGION
id:fred
width:40%

00:00:01.000 --> 00:00:02.000
regional`
        expect(parseWebVtt(text).cues.length).toBe(1)
    })

    it('tolerates cue settings on the timing line', () => {
        const text = `WEBVTT

00:00:01.000 --> 00:00:02.000 line:50% align:start
positioned`
        expect(parseWebVtt(text).cues[0].text).toBe('positioned')
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
