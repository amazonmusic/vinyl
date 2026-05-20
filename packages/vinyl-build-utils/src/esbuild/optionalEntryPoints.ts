/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs'

/**
 * Filters a record of entry points, excluding any entries where the file path does not exist.
 *
 * @param entryPoints - A record of entry point names to file paths
 * @returns A filtered record with only entries that exist on disk
 */
export function optionalEntryPoints(
    entryPoints: Record<string, string>
): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, path] of Object.entries(entryPoints)) {
        if (fs.existsSync(path)) {
            result[key] = path
        }
    }
    return result
}
