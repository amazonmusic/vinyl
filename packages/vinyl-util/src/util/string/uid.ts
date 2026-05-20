/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns a short unique id.
 * Optimized for performance. (2.1M ops/s ± 0.71%)
 * The returned value is 7-22 A-Za-z0-9 characters.
 *
 * The uniqueness of the returned string is the current timestamp to ms precision plus 2^53-1
 * possible values.
 *
 * The odds of a collision where n is the number of UIDs created within the same millisecond:
 * 1-((2^53-2)/(2^53-1))^C(n, 2)
 *
 * For 1000 UIDs created within the same millisecond the odds of a collision are:
 * 00.0000000055%, or 1 in 550 billion.
 */
export function createShortUid(): string {
    // Date.now 7-8 chars, Math.random: 0-13
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * @deprecated use createShortUid
 */
export const createUid = createShortUid
