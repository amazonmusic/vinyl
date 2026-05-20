/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { char, isWhitespaceChar, type StringReader } from '@amazon/vinyl-util'

const LF = char('\n')
const CR = char('\r')

/**
 * Reads a line from the StringReader, advancing past the line ending.
 * Returns the line content without the line ending.
 */
export function readLine(reader: StringReader): string {
    const line = reader.substringUntil((cc) => cc === LF || cc === CR)
    if (reader.hasNext() && reader.peek === CR) reader.next()
    if (reader.hasNext() && reader.peek === LF) reader.next()
    return line
}

/**
 * Skips whitespace-only content at the current position up to and including
 * the next line ending. Returns true if a whitespace-only line was skipped.
 */
export function skipWhitespaceLine(reader: StringReader): boolean {
    const start = reader.position
    reader.while((cc) => isWhitespaceChar(cc) && cc !== LF && cc !== CR)
    if (!reader.hasNext() || reader.peek === LF || reader.peek === CR) {
        if (reader.hasNext()) {
            if (reader.peek === CR) reader.next()
            if (reader.hasNext() && reader.peek === LF) reader.next()
        }
        return true
    }
    reader.position = start
    return false
}

/**
 * Conditionally adds properties from an attribute map to an object.
 * Only adds a property if the corresponding attribute key exists and is truthy.
 */
export function addIfPresent<T extends Record<string, any>>(
    obj: T,
    attrs: Record<string, string>,
    mappings: Record<string, string>
): T {
    for (const [attrKey, objKey] of Object.entries(mappings)) {
        if (attrs[attrKey]) {
            ;(obj as any)[objKey] = attrs[attrKey]
        }
    }
    return obj
}
