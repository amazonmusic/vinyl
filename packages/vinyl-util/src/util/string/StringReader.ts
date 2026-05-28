/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from '../../error/ErrorOrigin'
import { ReportableError } from '../../error/ReportableError'
import type { ParseError } from '../serialization/ParseError'
import { printStringPosition } from '../serialization/ParseError'
import { eqStr, isWhitespaceChar } from './string'
import type { Json } from '../serialization/json'

/**
 * A cursor on a string that allows for fast, naive parsing.
 */
export class StringReader {
    /**
     * @param data The string to read.
     */
    constructor(public data: string) {}

    /**
     * The current cursor.
     * This should always be between the range 0 and `data.length`
     */
    position = 0

    /**
     * Returns true if the current {@link position} is less than the source data's length.
     */
    hasNext(): boolean {
        return this.position < this.data.length
    }

    /**
     * Returns the number of characters remaining to be read.
     */
    get remaining(): number {
        return this.data.length - this.position
    }

    /**
     * Returns the length of {@link data}.
     */
    get length(): number {
        return this.data.length
    }

    /**
     * Throws a {@link StringParseError} where the location uses {@link printStringPosition} to
     * show a friendly message indicating the current position.
     *
     * @param message
     * @param offset The offset to add to the current position.
     */
    err(message: string, offset = 0): never {
        throw new StringParseError(this.data, this.position + offset, message)
    }

    /**
     * Reads and returns the character code at the current position.
     * To read the next character without advancing the cursor, use {@link peek}
     *
     * Note:
     * This method has no bounds checking; if {@link position} is greater than or equal to
     * `str.length` then NaN will be returned and {@link position} will still be incremented.
     *
     * @see String.charCodeAt
     */
    next(): number {
        return this.data.charCodeAt(this.position++)
    }

    /**
     * Reads characters until the predicate returns false or the data length has been reached.
     *
     * @param predicate Given the char code at the cursor index, returns true if the character
     * should be included in the substring result.
     * @returns number The start position.
     */
    while(predicate: (charCode: number) => boolean): number {
        const start = this.position
        let i = start
        const n = this.data.length
        while (i < n && predicate(this.data.charCodeAt(i))) i++
        this.position = i
        return start
    }

    /**
     * Reads characters until the predicate returns true or the string length has been reached.
     *
     * @param predicate
     * @returns number Returns the start index.
     */
    until(predicate: (charCode: number) => boolean): number {
        return this.while((charCode) => !predicate(charCode))
    }

    /**
     * Reads characters until the given character has been found or the string length has been
     * reached.
     *
     * @param charCode
     * @return number Returns the start index.
     */
    untilChar(charCode: number): number {
        return this.until((cc) => cc === charCode)
    }

    /**
     * Reads characters until the given string has been found or the string length has been
     * reached.
     *
     * @param string The string to match
     * @return number Returns the start index.
     */
    untilString(string: string): number {
        const start = this.position
        const index = this.data.indexOf(string, this.position)
        this.position = index === -1 ? this.data.length : index
        return start
    }

    /**
     * The same as {@link while} except returns the read substring as a result.
     */
    substringWhile(predicate: (charCode: number) => boolean): string {
        return this.data.substring(this.while(predicate), this.position)
    }

    /**
     * The same as {@link until} except returns the read substring as a result.
     */
    substringUntil(predicate: (charCode: number) => boolean): string {
        return this.substringWhile((charCode) => !predicate(charCode))
    }

    /**
     * The same as {@link untilChar} except returns the read substring as a result.
     */
    substringUntilChar(charCode: number): string {
        return this.substringWhile((iCharCode) => charCode !== iCharCode)
    }

    /**
     * Reads the substring from the current index with the given length.
     *
     * @param length
     */
    substr(length: number): string {
        const sub = this.data.substring(this.position, this.position + length)
        this.position += sub.length
        return sub
    }

    /**
     * Reads the expected string from the current position.
     * If the read string doesn't match the given string, a {@link StringParseError} is thrown.
     *
     * @param str The string required to match at the current position.
     * @param ignoreCase If true, the comparison will be case-insensitive.
     */
    read(str: string, ignoreCase = false): string {
        const actual = this.substr(str.length)
        if (!eqStr(actual, str, ignoreCase))
            this.err(`Expected '${str}', actual: '${actual}'`)
        return actual
    }

    /**
     * Reads the expected char code from the current position.
     * If the read character doesn't match the given character, a {@link StringParseError} is
     * thrown.
     *
     * @param charCode The character code required to match at the current position.
     */
    readChar(charCode: number): number {
        const actual = this.next()
        if (actual !== charCode)
            this.err(
                `Expected '${String.fromCharCode(charCode)}', ` +
                    `actual: '${String.fromCharCode(actual)}'`
            )
        return actual
    }

    /**
     * Returns the character at the current position without advancing the cursor.
     *
     * Note:
     * This method has no bounds checking; if {@link position} is greater than or equal to
     * `str.length` then `NaN` will be returned.
     *
     * @see String.charCodeAt
     */
    get peek(): number {
        return this.data.charCodeAt(this.position)
    }

    /**
     * Reads through all whitespace characters, returning the starting index.
     */
    white(): number {
        return this.while(isWhitespaceChar)
    }

    /**
     * If {@link peek} equals the given character code, returns true and advances the index by
     * one.
     *
     * @param charCode
     */
    charIf(charCode: number): boolean {
        if (this.peek === charCode) {
            this.next()
            return true
        } else {
            return false
        }
    }

    /**
     * If the given string matches the substring at the current position, returns true and advances
     * the index by the string's length.
     */
    stringIf(string: string, ignoreCase = false): boolean {
        if (this.remaining < string.length) return false
        const substr = this.data.substring(
            this.position,
            this.position + string.length
        )
        const match = eqStr(substr, string, ignoreCase)
        if (match) this.position += string.length
        return match
    }
}

const locale = {
    messageSeparator: ', at: \n',
} as const

export class StringParseError extends ReportableError implements ParseError {
    get [Symbol.toStringTag](): string {
        return 'StringParseError'
    }

    readonly location: string

    constructor(
        str: string,
        readonly position: number,
        readonly reason: string
    ) {
        const location = printStringPosition(str, position)
        super(
            `${reason}${locale.messageSeparator}${location}`,
            ErrorOrigin.PARSING
        )
        this.location = location
        Object.setPrototypeOf(this, StringParseError.prototype)
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            position: this.position,
            location: this.location,
            reason: this.reason,
        }
    }
}
