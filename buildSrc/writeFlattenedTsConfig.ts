/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseTsConfig } from '@amazon/vinyl-build-utils'
import { glob } from 'glob'
import path from 'node:path'
import { getCwd } from 'nx/src/utils/path'
import fs from 'node:fs'
import { cmd } from './processUtils'

/*
 * Generates the tsconfig.flat.json file
 * The tsconfig.flat.json is used for unit tests until tsx supports project references.
 * This script scans all tsconfig.json files and pulls up all path aliases.
 *
 * To use, from the package root run `tsx ./buildSrc/writeFlattenedTsConfig.ts`
 * @brief
 */

// Flattened path aliases needed for now until either tsx or ts-node support project references
// https://github.com/privatenumber/tsx/issues/96

const allPaths: Record<string, string[]> = {}
for (const configPath of glob
    .sync('**/tsconfig.json', {
        ignore: 'node_modules/**',
    })
    .sort()) {
    const projectConfig = parseTsConfig(configPath)
    const paths = projectConfig.parsed.options.paths
    if (paths) {
        for (const [key, pathEntries] of Object.entries(paths)) {
            if (!(key in allPaths)) allPaths[key] = []

            const rootRelativeEntries = pathEntries.map((pathEntry) => {
                return (
                    './' +
                    path.relative(
                        getCwd(),
                        path.resolve(path.dirname(configPath), pathEntry)
                    )
                )
            })

            allPaths[key].push(...rootRelativeEntries)
        }
    }
}
for (const key in allPaths) {
    allPaths[key] = removeDuplicates(allPaths[key])
}

fs.writeFileSync(
    'tsconfig.flat.json',
    `// This file is generated with tsx ./buildSrc/writeFlattenedTsConfig.ts; do not edit directly\n` +
        JSON.stringify(
            {
                extends: './tsconfig.base.json',
                files: [],
                compilerOptions: {
                    paths: allPaths,
                },
            },
            null,
            4
        )
)

cmd('prettier --write tsconfig.flat.json')

export function removeDuplicates<T>(array: T[]): T[] {
    return Array.from(new Set(array))
}
