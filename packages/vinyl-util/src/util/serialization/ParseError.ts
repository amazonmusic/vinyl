/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { clamp } from '@/util/math/math'

export interface ParseError {
    /**
     * The full reason and location.
     */
    readonly message: string

    /**
     * The reason for the error.
     */
    readonly reason: string

    /**
     * A description of the location the error occurred.
     */
    readonly location: string
}

export interface PrintStringPositionOptions {
    /**
     * The maximum number of character columns to output.
     * The number of columns shown will be the min of this value and the number of columns
     * at the index row.
     * The default is 60.
     */
    maxColumns?: number

    /**
     * The caret indicator.
     * The caret will be printed on a second row, directly underneath the column index
     * represents. This may more than one character, where the first character will align
     * with the index column.
     * The default value is '^'.
     */
    caret?: string

    /**
     * A number between 0 and 1 representing the percentage of trailing to leading characters.
     * 0 Indicates all trailing, 1 indicates all leading, and 0.5 indicates that the index
     * column is as close to the middle as possible.
     * The default value is 0.6.
     */
    split?: number
}

/**
 * Given a string and a position index, gets the row the index represents, displaying the
 * surrounding characters, with a second row showing a caret indicator pointing at the index.
 *
 * @param str
 * @param index The
 * @param options Display options
 */
export function printStringPosition(
    str: string,
    index: number,
    options?: PrintStringPositionOptions
): string {
    const caret = options?.caret || '^'
    index = clamp(index, 0, str.length)
    const minIndex = str.lastIndexOf('\n', index - 1) + 1
    let maxIndex = str.indexOf('\n', index)
    if (maxIndex === -1) maxIndex = str.length
    const split = options?.split === undefined ? 0.6 : options.split
    const cols = (options?.maxColumns ?? 60) - caret.length
    let leadingChars = cols * split
    let trailingChars = cols * (1 - split)
    const maxLeadingChars = index - minIndex
    const maxTrailingChars = maxIndex - index
    if (leadingChars > maxLeadingChars) {
        trailingChars += leadingChars - maxLeadingChars
        leadingChars = maxLeadingChars
        if (trailingChars > maxTrailingChars) trailingChars = maxTrailingChars
    } else if (trailingChars > maxTrailingChars) {
        leadingChars += trailingChars - maxTrailingChars
        trailingChars = maxTrailingChars
        if (leadingChars > maxLeadingChars) leadingChars = maxLeadingChars
    }
    let out = str.substring(index - leadingChars, index + trailingChars) + '\n'
    out += ' '.repeat(leadingChars) + caret
    return out
}
