/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { toJson } from './json'
import { truncate } from '../string/string'

/**
 * Stringifies a value suitable for human-readable messages.
 *
 * The value is first run through {@link toJson} which makes it safe for serialization.
 * (Circular references will become strings, and toJSON serializers will be respected)
 * The safe json is then stringified, using a JSON.stringify replacer that preserves
 * representations for NaN, Infinity, undefined, and Symbol.
 *
 * @param value Any value.
 * @param maxLength If provided, will truncate the final string.
 * @param indicator The truncation indicator.
 */
export function stringifyForPrint(
    value: any,
    maxLength?: number,
    indicator = '…'
): string {
    // Preserve Symbol, function, and undefined, NaN, and +/- Infinity
    let str = JSON.stringify(
        toJson(value),
        (_, value) => {
            const type = typeof value
            if (['undefined'].includes(type)) {
                return `{{${String(value)}}}`
            }
            if (type === 'number') {
                if (Number.isNaN(value) || !Number.isFinite(value))
                    return `{{${value.toString()}}}`
            }
            return value
        },
        '  '
    )
    // Replace templated

    str = str.replace(/("\{\{.*}}")/g, (_, s) => {
        return s.substring(3, s.length - 3)
    })
    if (maxLength) str = truncate(str, maxLength, indicator)
    return str
}
