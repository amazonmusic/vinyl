/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StringReader } from '@amazon/vinyl-util'
import { char } from '@amazon/vinyl-util'

const EQUALS = char('=')
const COMMA = char(',')
const QUOTE = char('"')

/**
 * Parses an HLS attribute list (e.g. `KEY=VALUE,KEY="quoted,value"`) using
 * StringReader cursor-based parsing. Handles quoted values with embedded commas.
 */
export function parseAttributes(reader: StringReader): Record<string, string> {
    const attrs: Record<string, string> = {}

    while (
        reader.hasNext() &&
        reader.peek !== char('\n') &&
        reader.peek !== char('\r')
    ) {
        const key = reader.substringUntilChar(EQUALS)
        if (!key || !reader.hasNext()) break
        reader.next() // skip '='

        let value: string
        if (reader.peek === QUOTE) {
            reader.next() // skip opening quote
            value = reader.substringUntilChar(QUOTE)
            if (reader.hasNext()) reader.next() // skip closing quote
        } else {
            value = reader.substringUntil(
                (cc) => cc === COMMA || cc === char('\n') || cc === char('\r')
            )
        }

        attrs[key] = value

        if (reader.hasNext() && reader.peek === COMMA) {
            reader.next() // skip ','
        }
    }

    return attrs
}
