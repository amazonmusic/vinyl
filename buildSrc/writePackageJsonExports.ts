/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// With many exports and type declaration versions, writing exports and typeVersions maps in the package.json files
// becomes tedious. This script outputs the package json fields to the console and optionally updates the
// package.json files if the --write flag is provided.
// Use -p packageName to provide a specific package.
// Usage: tsx ./buildSrc/writePackageJsonExports.ts [--write] [-p vinyl-util]

import { glob } from 'glob'
import path from 'node:path'
import fs from 'node:fs'
import type { SemVer } from 'semver'
import semver from 'semver'

const CURRENT_TS = '5.4'

function writePackageJsonExports() {
    const writeMode = process.argv.includes('--write')
    console.log(
        `Writing package.json exports to ${writeMode ? 'disk' : 'console'}.`
    )
    const packageIndex = process.argv.findIndex((arg) => arg.startsWith('-p'))
    let packageDirs: string[]
    if (packageIndex !== -1 && process.argv.length > packageIndex + 1) {
        const packageArg = `packages/${process.argv[packageIndex + 1]}`
        if (!fs.existsSync(packageArg)) {
            console.error(`package ${packageArg} not found`)
            process.exit(1)
        }
        packageDirs = [packageArg]
    } else {
        packageDirs = glob.sync('packages/*', {
            ignore: ['packages/vinyl-build-utils', 'packages/vinyl-website'],
        })
    }

    for (const packageDir of packageDirs) {
        // TypeScript 4.7 supports exports
        const distDir = `${packageDir}/dist`
        const packageJson: any = {
            module: './dist/index.js',
            main: './dist/index.cjs',
        }
        const exportsJson: any = {}
        packageJson.exports = exportsJson
        const typesVersionJson: any = {}
        packageJson.typesVersions = typesVersionJson

        for (const exportPath of glob.sync(`${distDir}/**/index.js`, {
            ignore: [`${distDir}/**/types/**`],
        })) {
            const exportDir = path.dirname(exportPath)
            const exportDirRel = path.relative(distDir, exportDir)
            const exportKey = exportDirRel ? `./${exportDirRel}` : '.'
            const exportJson: any = {}
            exportsJson[exportKey] = exportJson

            // development condition resolves to TS source so tests and tsc (via
            // tsconfig customConditions) can resolve cross-package imports without a build.
            // Convention: '.' -> src/index.ts; './X' -> src/X, test/X, or X under the package root.
            // Must come before `types@>=N` since conditional exports are first-match-wins;
            // otherwise the `types` condition (always passed by tsc) would short-circuit to dist.
            const sourceCandidates = exportDirRel
                ? [
                      `${packageDir}/src/${exportDirRel}/index.ts`,
                      `${packageDir}/test/${exportDirRel}/index.ts`,
                      `${packageDir}/${exportDirRel}/index.ts`,
                  ]
                : [`${packageDir}/src/index.ts`]
            const sourcePath = sourceCandidates.find((p) => fs.existsSync(p))
            if (sourcePath) {
                exportJson.development = `./${path.relative(packageDir, sourcePath)}`
            } else {
                console.warn(
                    `No source found for ${packageDir} export ${exportKey}; tried: ${sourceCandidates.join(', ')}`
                )
            }

            // Check type declarations, sorted by version descending so keys are inserted in the right order.
            const dtsIndexPaths = glob.sync(`${exportDir}/types/*/index.d.ts`)
            dtsIndexPaths.sort((a, b) => {
                const dirA = path.basename(path.resolve(a, '../'))
                const dirB = path.basename(path.resolve(b, '../'))
                const vA = semver.coerce(
                    dirA === 'current' ? CURRENT_TS : dirA
                ) as SemVer
                const vB = semver.coerce(
                    dirB === 'current' ? CURRENT_TS : dirB
                ) as SemVer
                return semver.rcompare(vA, vB)
            })
            for (const dtsIndexPath of dtsIndexPaths) {
                const dtsDirName = path.basename(
                    path.resolve(dtsIndexPath, '..')
                )
                const version =
                    dtsDirName === 'current'
                        ? CURRENT_TS
                        : /\D*([\d.]+)/.exec(dtsDirName)![1]
                const dtsPathRelative = `./${path.relative(packageDir, dtsIndexPath)}`

                const key = `>=${version}`
                if (!(key in typesVersionJson)) typesVersionJson[key] = {}
                const tsVersionMap = typesVersionJson[key]
                tsVersionMap[exportDirRel || '*'] = [dtsPathRelative]
                if (semver.gte(semver.coerce(version) as SemVer, '4.7.0')) {
                    // TypeScript versions below 4.7 do not respect the 'exports' field.
                    exportJson[`types@>=${version}`] = dtsPathRelative
                }
            }

            // require/import must come after development and @types.
            const commonJsPath = path.resolve(exportDir, 'index.cjs')
            if (fs.existsSync(commonJsPath)) {
                exportJson.require = `./${path.relative(packageDir, commonJsPath)}`
            }
            exportJson.import = `./${path.relative(packageDir, exportPath)}`
        }

        if (writeMode) {
            const packageJsonPath = path.resolve(packageDir, 'package.json')
            let originalPackageJson: any
            try {
                originalPackageJson = JSON.parse(
                    fs.readFileSync(packageJsonPath, 'utf-8')
                )
            } catch (_) {
                console.error(
                    `package.json could not be read at ${packageJsonPath}`
                )
                process.exit(1)
            }
            const newPackageJson = {
                ...originalPackageJson,
                ...packageJson,
            }
            fs.writeFileSync(
                packageJsonPath,
                JSON.stringify(newPackageJson, null, 4),
                'utf-8'
            )
        } else {
            console.log(JSON.stringify(packageJson, null, 4))
        }
    }
}

writePackageJsonExports()
