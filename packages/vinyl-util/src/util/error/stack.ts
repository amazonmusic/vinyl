/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { compareBy } from '../comparison/compare'
import { lazy } from '../object/lazy'
import type { Maybe } from '../type'

/**
 * A location in code.
 */
export interface CodeLocation {
    /**
     * The source location - may provide the function name or in some browsers the source file if
     * source maps are enabled.
     */
    readonly source: string | null

    /**
     * The url to the file.
     */
    readonly file: string | null

    /**
     * The row (line) number.
     */
    readonly row: number

    /**
     * The column number. May not be present on all browsers (e.g. Firefox < 30).
     */
    readonly col: number | null
}

/**
 * A Comparator for determining if one code location is before or after another.
 *
 * @private
 */
export const codeLocationComparator = compareBy<CodeLocation>(
    (stack) => stack.file,
    (stack) => stack.row,
    (stack) => stack.col
)

/**
 * Boundary code locations, used to determine if an error is within a certain range of code.
 * The start and end boundaries must be the same path and file to be a valid range.
 */
export interface CodeRange {
    /**
     * The starting code location (inclusive)
     */
    readonly start: CodeLocation | null

    /**
     * The ending code location (exclusive)
     */
    readonly end: CodeLocation | null
}

/**
 * Creates a code range object from two error markers.
 * @see parseStackLocation
 */
export function createRangeFromErrorMarkers(
    start: Error | undefined,
    end: Error | undefined
): CodeRange {
    return {
        start: parseStackLocation(start?.stack),
        end: parseStackLocation(end?.stack),
    }
}

/**
 * Returns true if the given location is within a range of code.
 *
 * @param location The location of the code to check if within bounds. If falsy, false is
 * returned.
 * @param range The boundaries to check against. If both start and end are null, false is
 * returned. The range will consider `range.start` to be inclusive, and `range.end` to be exclusive.
 */
export function isCodeLocationInRange(
    location: Maybe<CodeLocation>,
    range: CodeRange
): boolean {
    if (!location) return false
    const { start, end } = range
    if (!start && !end) return false
    if (start && codeLocationComparator(location, start) < 0) return false
    return !(end && codeLocationComparator(location, end) >= 0)
}

interface StackParseOptions {
    /**
     * A regex for parsing an error stack string.
     * This should be non-stateful (not sticky or global)
     *
     * If a stateful stack regex is needed, (e.g. parsing every location of a stack trace) a new
     * regex can be created using the source of this one.
     */
    readonly regex: RegExp

    /**
     * The group index for the source file.
     */
    readonly sourceGroup: number | null

    /**
     * The group index for the file name.
     */
    readonly fileGroup: number

    /**
     * The group index for the row/line. (Should be digits only)
     */
    readonly rowGroup: number

    /**
     * The group index for the column. (Should be digits only)
     * Some browsers (e.g. Firefox < 30) may not provide a column number.
     */
    readonly colGroup: number | null
}

/**
 * Regex possibilities to parse the stack.
 * The first one to match will be used.
 */
const parseOptions: StackParseOptions[] = [
    {
        // V8 (Chrome/Node) / Chakra (Edge), with source location
        regex: /^\s*at\s*(.*)\s+\(((?:.+\/)?[^:]*):(\d+)(?::(\d+))?\)/m,
        sourceGroup: 1,
        fileGroup: 2,
        rowGroup: 3,
        colGroup: 4,
    },
    {
        // V8 (Chrome/Node) / Chakra (Edge), no source location
        regex: /^\s*at\s*((?:.+\/)?[^:]*):(\d+)(?::(\d+))?/m,
        sourceGroup: null,
        fileGroup: 1,
        rowGroup: 2,
        colGroup: 3,
    },
    {
        // SpiderMonkey (Firefox) / JavaScriptCore (Safari)
        regex: /^\s*(.+)?@((?:.+\/)?[^:]*):(\d+)(?::(\d+))?/m,
        sourceGroup: 1,
        fileGroup: 2,
        rowGroup: 3,
        colGroup: 4,
    },
]

/**
 * Returns the value of the group by index, or null if the group doesn't exist or the group
 * index is null. The value will be parsed if it exists.
 */
function getOptionalGroup<T>(
    match: RegExpMatchArray,
    index: number | null,
    parse: (value: string) => T
): T | null {
    if (index == null) return null
    const value = match[index] as Maybe<string>
    if (value == null) return null
    return parse(value)
}

/**
 * Returns the location of the stack's first line match; the location the error was constructed.
 *
 * @param stack
 */
export function parseStackLocation(stack?: Maybe<string>): CodeLocation | null {
    if (!stack) return null
    const noise = stackNoise.value
    if (stack.substring(0, noise.length) === noise) {
        stack = stack.substring(noise.length)
    }
    for (const o of parseOptions) {
        const match = o.regex.exec(stack)
        if (!match) continue
        return {
            source: getOptionalGroup(match, o.sourceGroup, String),
            file: match[o.fileGroup],
            row: parseInt(match[o.rowGroup]),
            col: getOptionalGroup(match, o.colGroup, parseInt),
        }
    }
    return null
}

/**
 * Used in comparison with `stackNoiseError2` to determine what leading stack lines should be
 * trimmed.
 * @private
 */
export const stackNoiseError1 = new Error()

/**
 * @private
 */
export const stackNoiseError2 = new Error()

/**
 * When corejs polyfills Error with clearErrorStack, the stack may begin with the polyfill
 * location. Trim the beginning of stacks with the leading lines common to all errors.
 */
export const stackNoise = lazy<string>(() => {
    if (!stackNoiseError1.stack) return ''
    const stack1 = stackNoiseError1.stack.split('\n')
    const stack2 = stackNoiseError2.stack!.split('\n')
    let noise = ''
    for (let i = 0; i < Math.min(stack1.length, stack2.length); i++) {
        if (stack1[i] === stack2[i]) noise += stack1[i] + '\n'
        else break
    }
    return noise
})
