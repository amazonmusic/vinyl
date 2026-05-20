/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs'
import path from 'node:path'
import type { TsProjectConfig } from './parseTsConfig.js'
import { parseTsConfig } from './parseTsConfig.js'

/**
 * Resolves to a Set of paths representing all project references branching from a starting config.
 *
 * @param configFile The tsconfig.json starting point, references from this starting point will be walked.
 */
export function resolveProjectReferences(
    configFile: string
): TsProjectConfig[] {
    const out: TsProjectConfig[] = []
    walkProjectReferences(configFile, new Set(), out)
    return out
}

/**
 * Walks project references, accumulating the parsed project references into an output array.
 *
 * @param configFile The tsconfig.json path.
 * @param walked A set of currently walked configs.
 * @param out The output array.
 */
function walkProjectReferences(
    configFile: string,
    walked: Set<string> = new Set(),
    out: TsProjectConfig[]
) {
    const resolvedConfigFile = path.resolve(configFile)
    if (walked.has(resolvedConfigFile)) return
    walked.add(resolvedConfigFile)

    const projectConfig = parseTsConfig(resolvedConfigFile)
    out.push(projectConfig)

    if (projectConfig.parsed.projectReferences) {
        const baseDir = path.dirname(resolvedConfigFile)
        for (const reference of projectConfig.parsed.projectReferences) {
            let nextProject = path.resolve(baseDir, reference.path)
            if (fs.statSync(nextProject).isDirectory()) {
                nextProject = path.join(nextProject, 'tsconfig.json')
            }
            walkProjectReferences(nextProject, walked, out)
        }
    }
}
