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
import crypto from 'node:crypto'

const write = process.argv.includes('--write')

async function getBundleSize(
    importName: string,
    importPath: string
): Promise<number> {
    const virtualEntry = path.join(
        os.tmpdir(),
        `analyze-exports-${importName}-${crypto.randomUUID()}.js`
    )
    await fs.writeFile(
        virtualEntry,
        `import { ${importName} } from "${importPath}";\nconsole.log(${importName});`
    )

    try {
        const result = await esbuild.build({
            entryPoints: [virtualEntry],
            bundle: true,
            write: false,
            treeShaking: true,
            minify: true,
            format: 'esm',
            platform: 'node',
            logLevel: 'silent',
        })
        return result.outputFiles[0].text.length
    } finally {
        await fs.unlink(virtualEntry).catch(() => undefined)
    }
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

    for (const name of exportNames) {
        try {
            exportSizes[name] = await getBundleSize(name, importPath)
        } catch (err: any) {
            exportSizes[name] = -1 // Mark error
            console.error(`Failed to bundle "${name}":`, err.message)
        }
    }

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
