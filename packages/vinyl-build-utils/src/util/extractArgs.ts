/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Given CLI arguments, extracts properties starting with --, separating args that do not.
 *
 * @param argv process args.
 */
export function extractArgs(argv: readonly string[]): {
    properties: { [key: string]: string }
    args: string[]
} {
    const properties: { [key: string]: string } = {}
    const args: string[] = []

    argv.forEach((item) => {
        if (item.startsWith('--')) {
            const split = item.substring(2).split('=', 2)
            properties[split[0]] = split[1] ?? true
        } else {
            args.push(item)
        }
    })

    return { properties, args }
}
