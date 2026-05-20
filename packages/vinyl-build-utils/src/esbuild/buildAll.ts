/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BuildOptions } from 'esbuild'
import { build, context } from 'esbuild'

export interface BuildAllOptions {
    /**
     * If true, the process will remain open in watch mode until terminated via Ctrl+C
     */
    readonly watch?: boolean
}

/**
 * Builds all entries in parallel, optionally in watch mode.
 */
export async function buildAll(
    entries: readonly BuildOptions[],
    options?: BuildAllOptions
): Promise<void> {
    // Build all entries in parallel.
    await Promise.all(entries.map((entry) => build(entry)))
    if (options?.watch) {
        // Watch all entries.
        await Promise.all(
            entries.map(async (entry) => (await context(entry)).watch())
        )
    }
}
