/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import os from 'os'
import { exit } from 'process'
import esbuild from 'esbuild'

const write = process.argv.includes('--write')

async function getBundleSize(
    importName: string,
    importPath: string
): Promise<number> {
    // A `stdin` entry avoids writing (and cleaning up) a temp file per export;
    // the absolute `importPath` resolves regardless of `resolveDir`.
    const result = await esbuild.build({
        stdin: {
            contents: `import { ${importName} } from ${JSON.stringify(importPath)};\nconsole.log(${importName});`,
            resolveDir: path.dirname(importPath),
            loader: 'js',
        },
        bundle: true,
        write: false,
        treeShaking: true,
        minify: true,
        format: 'esm',
        platform: 'node',
        logLevel: 'silent',
    })
    return result.outputFiles[0].text.length
}

/**
 * Runs `task` over every item with at most `concurrency` in flight. Order is
 * not preserved; each task writes its own result.
 */
async function forEachConcurrent<T>(
    items: readonly T[],
    concurrency: number,
    task: (item: T) => Promise<void>
): Promise<void> {
    let next = 0
    const runners = Array.from(
        { length: Math.min(concurrency, items.length) },
        async () => {
            while (next < items.length) {
                await task(items[next++])
            }
        }
    )
    await Promise.all(runners)
}

export interface AnalyzeExportsOptions {
    readonly name: string
    readonly target: string
    readonly reportPath?: string
}

export async function analyzeExports({
    name,
    target,
    reportPath,
}: AnalyzeExportsOptions): Promise<void> {
    const exportSizes: Record<string, number> = {}

    // Resolve from local
    const importPath = path.resolve(target)

    const exports = await import(importPath)
    const exportNames = Object.keys(exports)

    // Each export is bundled independently to measure its tree-shaken size;
    // the builds are independent, so run them concurrently (bounded by CPUs).
    await forEachConcurrent(
        exportNames,
        Math.max(1, os.cpus().length),
        async (exportName) => {
            try {
                exportSizes[exportName] = await getBundleSize(
                    exportName,
                    importPath
                )
            } catch (err: any) {
                exportSizes[exportName] = -1 // Mark error
                console.error(`Failed to bundle "${exportName}":`, err.message)
            }
        }
    )

    const validSizes = Object.values(exportSizes).filter((size) => size > 0)
    const minBundleSize = validSizes.length > 0 ? Math.min(...validSizes) : 0
    const report = { minBundleSize }

    const outPath = path.resolve(
        reportPath ?? `./reports/treeShaking/${name}.json`
    )
    if (existsSync(outPath)) {
        const previousJson = JSON.parse(await fs.readFile(outPath, 'utf-8'))
        const previousMinSize = previousJson.minBundleSize

        if (previousMinSize && minBundleSize > 0) {
            const delta = minBundleSize - previousMinSize
            const percent = delta / previousMinSize

            if (percent > 0.1) {
                console.log(` ⚠️  Size increase detected:`)
                console.log(
                    `   from ${previousMinSize} → ${minBundleSize} bytes (+${Math.round(percent * 100)}%)`
                )
                if (!write) {
                    console.error(
                        ` ❌ ${name} - Aborting due to significant size increase.`
                    )
                    exit(1)
                }
            }
        }
    } else {
        if (!write) {
            console.error(` ❌ Tree shaking report missing for ${name}`)
            exit(1)
        }
    }

    if (write) {
        await fs.mkdir(path.dirname(outPath), { recursive: true })
        await fs.writeFile(outPath, JSON.stringify(report, null, 2))

        console.log(` ✅ Report written to ${outPath}`)
    } else {
        console.log(` ✅ No significant size increase for ${name}.`)
    }
}
