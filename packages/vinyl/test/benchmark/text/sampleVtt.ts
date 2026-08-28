/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/** Payload templates cycled across the generated cues, exercising the payload
 * shapes the parser must handle: styled classes, inline tags, voice/lang spans,
 * multi-line cues, and dialogue dashes. Generic placeholder text. */
const PAYLOADS = [
    `<c.emphasis>The quick brown fox jumps</c>`,
    `<c.emphasis>over the lazy dog.</c>`,
    `<c.emphasis>A sentence that wraps\nacross two lines of caption.</c>`,
    `-<c.emphasis>First speaker line.</c>\n-Second speaker replies.`,
    `-Line one of dialogue.\n-Line two of dialogue.`,
    `<i>Italic emphasis here</i>\n<b>and bold on the next line.</b>`,
    `<v Speaker>A line attributed to a voice.</v>`,
    `Lorem ipsum dolor sit amet.`,
]

const SETTINGS = [
    ' align:middle line:85%,start position:50%,middle',
    ' align:start line:80% position:20%,line-left size:80%',
    '',
]

function buildSampleVtt(cueCount: number): string {
    const blocks = [
        'WEBVTT',
        'X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000',
        '',
        'STYLE',
        '::cue(.emphasis) { font-style:italic }',
        '',
    ]
    for (let i = 0; i < cueCount; i++) {
        blocks.push(
            String(i + 1),
            `${formatTs(i * 3)} --> ${formatTs(i * 3 + 2)}${SETTINGS[i % SETTINGS.length]}`,
            PAYLOADS[i % PAYLOADS.length],
            ''
        )
    }
    return blocks.join('\n')
}

function formatTs(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}.000`
}

/**
 * A large, complex WebVTT document for benchmarking the parser. Modeled on
 * real sidecar caption output (a `STYLE` block with a `::cue` class rule,
 * per-cue timing settings, `<c.class>` / `<i>` / `<v>` payload tags, multi-line
 * cues, and dialogue dashes), scaled up to thousands of cues.
 */
export const sampleVtt = buildSampleVtt(4000)
