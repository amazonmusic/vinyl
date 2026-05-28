/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Standalone build for the ABR benchmark harness. Not part of CI.
 * Bundles the browser-side harness entry into dist/abrBenchmark/abrBenchmark.js
 * and copies harness.html alongside it.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { commonVinylBuildOptions } from '@amazon/vinyl-build-utils'
import { build } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(__dirname, '../..')
const outDir = path.join(packageDir, 'dist/abrBenchmark')

await build({
    entryPoints: [path.join(__dirname, 'harnessEntry.ts')],
    ...commonVinylBuildOptions,
    external: [], // Bundle everything for the browser
    format: 'iife',
    outfile: path.join(outDir, 'abrBenchmark.js'),
    define: {
        ...commonVinylBuildOptions.define,
        'globalThis.__VINYL_VERSION__': '"0.0.0"',
    },
    absWorkingDir: packageDir,
})

fs.copyFileSync(
    path.join(__dirname, 'harness.html'),
    path.join(outDir, 'harness.html')
)
