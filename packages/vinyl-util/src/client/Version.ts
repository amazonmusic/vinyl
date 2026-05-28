/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Comparator } from '../util/comparison/compare'
import { compareBy } from '../util/comparison/compare'
import type { Maybe } from '../util/type'
import { parseIntSafe } from '../util/serialization/primitives'

/**
 * An object representing a version.
 */
export interface Version {
    readonly str: string
    readonly major: number
    readonly minor: number | null
    readonly patch: number | null
    readonly build: number | null
}

/**
 * A comparator for Version objects.
 * This strict comparator will consider 1.0.0 > 1.0. Use {@link compareVersions} if null
 * segments should be treated as zero values.
 * Use this comparator when stable sorting.
 */
export const compareVersionsStrict: Comparator<Version | null> =
    compareBy<Version>(
        (v) => v.major,
        (v) => v.minor,
        (v) => v.patch,
        (v) => v.build,
        (v) => v.str
    )

/**
 * A comparator for Version objects.
 * Unlike {@link compareVersionsStrict}, 1.0.0.0 === 1.
 * Use this comparator when comparing two versions and order does not need to be stable.
 */
export const compareVersions: Comparator<Version | null> = compareBy<Version>(
    (v) => v.major,
    (v) => v.minor ?? 0,
    (v) => v.patch ?? 0,
    (v) => v.build ?? 0
)

const versionRegex = /(\b\w*\d(?:[._-]\d+)*[\w-._]*)/

/**
 * Given a string containing a semver-like version string, finds and returns the parsed Version.
 *
 * @param str
 */
export function parseVersion(str: string): Version

/**
 * Given a string containing a semver-like version string, finds and returns the parsed Version.
 *
 * @param str
 */
export function parseVersion(str: Maybe<string>): Version | null

/**
 * Given a string containing a semver-like version string, finds and returns the parsed Version.
 *
 * @param str
 */
export function parseVersion(str: Maybe<string>): Version | null {
    if (!str) return null
    const match = versionRegex.exec(str)
    if (!match) return null
    const parts = match[0].match(/\d+/g)!
    return {
        str: match[0],
        major: parseInt(parts[0]),
        minor: parseIntSafe(parts[1]),
        patch: parseIntSafe(parts[2]),
        build: parseIntSafe(parts[3]),
    }
}
