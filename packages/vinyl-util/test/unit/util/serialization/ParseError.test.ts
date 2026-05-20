/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { printStringPosition } from '@amazon/vinyl-util'

describe('printStringPosition', () => {
    it('places a caret underneath the specified index', () => {
        expect(
            printStringPosition('This is a string', 5, {
                maxColumns: 60,
                split: 0.6,
            })
        ).toBe(`This is a string\n     ^`)
    })

    it('only displays the current row', () => {
        expect(
            printStringPosition('1 - Row\n2 - Row\n3 - Row', 8, {
                maxColumns: 60,
                split: 0.6,
            })
        ).toBe(`2 - Row\n^`)
    })

    it('only displays the maximum columns', () => {
        expect(
            printStringPosition('This is some test that is 36 columns', 20, {
                maxColumns: 10,
                split: 0,
            })
        ).toBe(`at is 36 \n^`)
        expect(
            printStringPosition('This is some test that is 36 columns', 0, {
                maxColumns: 10,
                split: 1,
            })
        ).toBe(`This is s\n^`)
        expect(
            printStringPosition('This is some test that is 36 columns', 100, {
                maxColumns: 10,
                split: 1,
            })
        ).toBe(`6 columns\n         ^`)
        expect(
            printStringPosition('This is some test that is 36 columns', 100, {
                maxColumns: 10,
                split: 0,
            })
        ).toBe(`6 columns\n         ^`)
        expect(
            printStringPosition('10 columns', 100, { maxColumns: 20, split: 0 })
        ).toBe(`10 columns\n          ^`)
    })

    it('allows the caret to overhang when the index is the end of the line', () => {
        expect(
            printStringPosition('This is some test that is 36 columns', 37, {
                maxColumns: 10,
            })
        ).toBe(`6 columns\n         ^`)
        expect(
            printStringPosition('This is some\ntest that is 36 columns', 12, {
                maxColumns: 10,
            })
        ).toBe(`s is some\n         ^`)
        expect(
            printStringPosition('This is some\ntest that is 36 columns', 12, {
                maxColumns: 10,
                caret: '^err',
            })
        ).toBe(`s some\n      ^err`)
    })

    it('handles an index of 0', () => {
        expect(
            printStringPosition('This is some test that is 36 columns', 0, {
                maxColumns: 10,
            })
        ).toBe(`This is s\n^`)
    })

    it('clamps when the index is out of range', () => {
        expect(
            printStringPosition('This is some', -1, { maxColumns: 10 })
        ).toBe(`This is s\n^`)
        expect(
            printStringPosition('This is some', 100, { maxColumns: 10 })
        ).toBe(`s is some\n         ^`)
    })

    it('considers the index at a newline to be the end of the column', () => {
        expect(printStringPosition('This is\nsome', 7)).toBe(
            `This is\n       ^`
        )
    })

    it('has a default split of 0.6', () => {
        expect(
            printStringPosition('This is a test of the default split', 5, {})
        ).toBe(
            printStringPosition('This is a test of the default split', 5, {
                split: 0.6,
            })
        )
    })
})
