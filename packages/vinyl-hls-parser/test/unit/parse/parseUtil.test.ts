/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringReader } from '@amazon/vinyl-util'
import { readLine, skipWhitespaceLine } from '@amazon/vinyl-hls-parser'

describe('parseUtil', () => {
    describe('readLine', () => {
        it('reads line with LF ending', () => {
            const reader = new StringReader('line1\nline2')
            expect(readLine(reader)).toBe('line1')
            expect(readLine(reader)).toBe('line2')
        })

        it('reads line with CR ending', () => {
            const reader = new StringReader('line1\rline2')
            expect(readLine(reader)).toBe('line1')
            expect(readLine(reader)).toBe('line2')
        })

        it('reads line with CRLF ending', () => {
            const reader = new StringReader('line1\r\nline2')
            expect(readLine(reader)).toBe('line1')
            expect(readLine(reader)).toBe('line2')
        })

        it('reads line with only CR at EOF', () => {
            const reader = new StringReader('line\r')
            expect(readLine(reader)).toBe('line')
        })

        it('reads line with only LF at EOF', () => {
            const reader = new StringReader('line\n')
            expect(readLine(reader)).toBe('line')
        })

        it('reads line without ending at EOF', () => {
            const reader = new StringReader('lastline')
            expect(readLine(reader)).toBe('lastline')
        })
    })

    describe('skipWhitespaceLine', () => {
        it('skips whitespace-only line with LF', () => {
            const reader = new StringReader('  \t  \ntext')
            expect(skipWhitespaceLine(reader)).toBe(true)
            expect(readLine(reader)).toBe('text')
        })

        it('skips whitespace-only line with CR', () => {
            const reader = new StringReader('  \t  \rtext')
            expect(skipWhitespaceLine(reader)).toBe(true)
            expect(readLine(reader)).toBe('text')
        })

        it('skips whitespace-only line with CRLF', () => {
            const reader = new StringReader('  \t  \r\ntext')
            expect(skipWhitespaceLine(reader)).toBe(true)
            expect(readLine(reader)).toBe('text')
        })

        it('skips whitespace-only line at EOF', () => {
            const reader = new StringReader('  \t  ')
            expect(skipWhitespaceLine(reader)).toBe(true)
        })

        it('does not skip non-whitespace line', () => {
            const reader = new StringReader('  text  ')
            expect(skipWhitespaceLine(reader)).toBe(false)
            expect(readLine(reader)).toBe('  text  ')
        })

        it('handles empty reader', () => {
            const reader = new StringReader('')
            expect(skipWhitespaceLine(reader)).toBe(true)
        })
    })
})
