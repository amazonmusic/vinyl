/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { BuildOptions } from 'esbuild'
import { vinylDefaultTscOptions } from './vinylDefaultTscOptions'
import { tscPlugin } from '../esbuild/TypeDeclarationsPlugin'
import { compatTransformPlugin } from '../esbuild/CompatTransformPlugin'
import { copyFiles } from '../util/copyFiles'
import { buildAll } from '../esbuild/buildAll'
import { pureExportsPlugin } from '../esbuild/PureExportsPlugin'
import { startServer, type ServerOptions } from '../express/serve'
import { logger, LogLevel } from '../util/Logger'
import { optionalEntryPoints } from '../esbuild/optionalEntryPoints'
import { getRootProjectDir } from '../util/getRootProjectDir'

/*
 * Every vinyl package has common build configuration, buildVinylPackage will run configure esbuild, file watchers,
 * tsc, and express.
 * Every package may have unit, integ, and benchmark tests, will be compiled for esm and cjs, and will set up jasmine
 * for running tests in a browser.
 *
 * @brief
 */

export interface VinylPackageOptions {
    /**
     * Can be set to add additional entry points for bundling.
     */
    readonly buildOptions?: BuildOptions[]

    /**
     * Options to apply to each esbuild target defined in `buildOptions`.
     *
     * Takes precedence over `commonVinylBuildOptions`
     */
    readonly commonOptions?: Partial<BuildOptions>

    /**
     * Express server options used when invoked with `--serve`.
     * Packages that opt into a dev server (e.g. vinyl) supply
     * their own configuration; if omitted, `--serve` will not start a server.
     */
    readonly serverOptions?: ServerOptions
}

const argv = process.argv
const release = argv.includes('--release')
const serve = argv.includes('--serve')
const watch = argv.includes('--watch') || serve
const debug = argv.includes('--debug')

/**
 * CLI args.
 */
export const vinylBuildCliOptions = {
    release,
    serve,
    watch,
    debug,
}

/**
 * Common vinyl library build config.
 */
export const commonVinylBuildOptions: BuildOptions = {
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2017',
    minify: false,
    sourcemap: true,
    logLevel: debug ? 'debug' : 'info',
    metafile: true,
    external: ['@amazon/*'],
    define: {
        global: 'globalThis',
    },
}

/**
 * Builds a vinyl package with inferred configuration.
 *
 * @param options
 */
export function buildVinylPackage(options?: VinylPackageOptions) {
    if (debug) logger.level = LogLevel.DEBUG
    const overriddenOptions = options?.commonOptions ?? {}
    // Merge overridden options, apply commonVinylBuildOptions then options.commonOptions
    const commonOptions = {
        ...commonVinylBuildOptions,
        ...overriddenOptions,
        define: {
            ...commonVinylBuildOptions.define,
            ...overriddenOptions.define,
        },
    }
    const require = createRequire(import.meta.url)

    const tsc = tscPlugin(vinylDefaultTscOptions)

    const compat = compatTransformPlugin({
        enabled: release,
    })

    const testEntries: BuildOptions[] = []

    const rootDir = getRootProjectDir()!

    // Copy and optionally watch the html assets.
    const sharedTestResourcesDir = `${rootDir}/testResources`
    const testResourcesDir = 'test/jasmine/resources'
    const testDist = './dist/test'
    if (fs.existsSync('./test/integ')) {
        // If this package has integ tests, copy the integ test resources,
        // from /testResources, test/jasmine/resources (optional), and copy the jasmine wrapper and css
        copyFiles({
            src: sharedTestResourcesDir,
            dest: testDist,
            required: true,
            watch,
            debug,
            filter: (source) => {
                if (fs.lstatSync(source).isDirectory()) {
                    return true
                }
                // If the file is to be overwritten in the project-specific test resources folder, do not copy from the
                // shared test resources.
                const relPath = path.relative(sharedTestResourcesDir, source)
                return !fs.existsSync(path.resolve(testResourcesDir, relPath))
            },
        })

        copyFiles({
            src: testResourcesDir,
            dest: testDist,
            required: false,
            watch,
            debug,
        })

        // Copy the jasmine css. No need for a watch, imported module doesn't change.
        copyFiles({
            src: require.resolve('jasmine-core/lib/jasmine-core/jasmine.css'),
            dest: './dist/test/jasmine.css',
            debug,
        })

        testEntries.push({
            stdin: {
                contents: `import '@amazon/vinyl-jasmine-wrapper'`,
                resolveDir: process.cwd(),
                loader: 'ts',
            },
            ...commonOptions,
            external: [],
            conditions: ['development'],
            plugins: [compat],
            outfile: 'dist/test/jasmineHtml.js',
        })
    }

    if (serve || release) {
        // Check for integ, unit, and benchmark tests
        testEntries.push({
            entryPoints: optionalEntryPoints({
                integ: 'test/integ/index.ts',
                benchmark: 'test/benchmark/index.ts',
            }),
            ...commonOptions,
            external: [], // Bundle everything together for integ
            conditions: ['development'], // Resolve cross-package imports to source
            format: 'iife',
            outdir: 'dist/test/',
            plugins: [tsc, compat],
        })
    }

    // Build and optionally watch all targets.
    buildAll(
        [
            {
                entryPoints: ['src/index.ts'],
                ...commonOptions,
                plugins: [tsc, pureExportsPlugin],
                outfile: 'dist/index.js',
            },
            {
                entryPoints: ['src/index.ts'],
                ...commonOptions,
                format: 'cjs',
                // No need to run tsc again, esm entry point compiles declarations
                plugins: [pureExportsPlugin],
                outfile: 'dist/index.cjs',
            },
            ...(options?.buildOptions ?? []),
            ...testEntries,
        ],
        { watch }
    )
        .then(() => {
            if (serve) {
                if (!options?.serverOptions)
                    throw new Error('serverOptions not set')
                void startServer(options.serverOptions)
            }
        })
        .catch((error: any) => {
            console.error('message' in error ? error.message : error)
            process.exit(1)
        })
}
