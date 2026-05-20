/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs'
import { glob } from 'glob'
import path from 'node:path'
import { ansi } from './console'

/**
 * If --check argument is provided, do not write an index.ts file, check that the existing one
 * is correct.
 */
const verifyMode = process.argv.includes('--check')

export interface IndexFileOptions {
    readonly header?: string
    readonly footer?: string
}

/**
 * Generates an index.ts for the given directory.
 *
 * @param dir
 * @param out
 * @param options Extra configuration, see {@link IndexFileOptions}
 */
export function writeIndexFile(
    dir: string,
    out: string = dir,
    options?: IndexFileOptions
) {
    const header =
        options?.header ?? `/** Auto-generated from build scripts */\n`
    let footer = options?.footer ?? ''
    if (footer && !footer.endsWith('\n')) footer += '\n'

    const allSrcFiles = glob.sync(`${dir}/**/*.ts`, {
        ignore: ['**/index.ts', '**/@types/**'],
    })

    const relativePaths = allSrcFiles
        .map((srcFile) => {
            const importPath = path.relative(out, srcFile)
            return {
                importOrExport: hasExports(srcFile)
                    ? 'export * from'
                    : 'import',
                path: `./${importPath.substring(0, importPath.length - 3)}`,
            }
        })
        .sort()

    const outFile = path.join(out, 'index.ts')

    function fail(): never {
        console.error(
            `${ansi.red}${outFile} not valid, run indexFiles:write${ansi.resetColor}`
        )
        process.exit(1)
    }

    if (verifyMode) {
        console.log('validating index file:', outFile)
        if (!fs.existsSync(outFile)) {
            fail()
        } else {
            let contents = fs.readFileSync(outFile, 'utf8')
            if (
                contents.substring(0, header.length) !== header ||
                contents.substring(
                    contents.length - footer.length,
                    contents.length
                ) !== footer
            )
                fail()
            contents = contents.substring(
                header.length,
                contents.length - footer.length
            )
            const lines = contents
                .split('\n')
                .filter(
                    (line) =>
                        line.startsWith('export') || line.startsWith('import')
                )
            if (lines.length !== relativePaths.length) fail()
            for (let i = 0; i < lines.length; i++) {
                const { path, importOrExport } = relativePaths[i]
                if (
                    !lines[i].startsWith(importOrExport) ||
                    !lines[i].includes(path)
                )
                    fail()
            }
        }
    } else {
        // Write the index.ts file
        let indexStr = header
        indexStr +=
            relativePaths
                .map(
                    ({ importOrExport, path }) => `${importOrExport} '${path}'`
                )
                .join('\n') + '\n'

        if (!fs.existsSync(out)) {
            fs.mkdirSync(out, { recursive: true })
        }
        indexStr += footer
        fs.writeFileSync(outFile, indexStr)
        console.log(`indices written to ${out}`)
    }
}

/**
 * Checks if the given file has any exports.
 *
 * @param path
 */
function hasExports(path: string): boolean {
    const contents = fs.readFileSync(path, 'utf8')
    return /(?<!['"`])\bexport\b(?![`'"])/.test(contents)
}
