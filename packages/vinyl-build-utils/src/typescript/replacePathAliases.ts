/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveProjectReferences } from './resolveProjectReferences'
import { replaceTscAliasPaths } from 'tsc-alias'
import { parseTsConfig } from './parseTsConfig'

interface ReplaceAliasesOptions {
    readonly configFile: string
    readonly debug?: boolean
}

/**
 * Replaces alias paths, following project references.
 */
export async function replacePathAliases(
    options: ReplaceAliasesOptions
): Promise<void> {
    // tsc-alias does not currently support project references.
    // https://github.com/justkey007/tsc-alias/issues/171
    const projectRefs = resolveProjectReferences(options.configFile)
    for (const { configFile } of projectRefs) {
        const { parsed } = parseTsConfig(configFile)
        const opts = parsed.options
        if (opts.noEmit || !opts.declaration || (!opts.outDir && !opts.outFile))
            continue

        await replaceTscAliasPaths({
            configFile,
            debug: options.debug ?? false,
            verbose: false,
        })
    }
}
