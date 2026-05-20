/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses a string with name value pairs into an object.
 *
 * For example:
 * ```
 * key1=value1
 * key2=value2
 * ```
 *
 * Becomes
 *
 * ```
 * {
 *   key1: 'value1'
 *   key2: 'value2'
 * }
 * ```
 *
 * @param str
 */
export function parseKeyValueStr(str: string): Record<string, string> {
    const config: Record<string, string> = {}
    const lines = str.split('\n')
    for (const line of lines) {
        if (line.includes('=')) {
            const [key, value] = line.split('=', 2)
            config[key.trim()] = value.trim()
        }
    }
    return config
}
