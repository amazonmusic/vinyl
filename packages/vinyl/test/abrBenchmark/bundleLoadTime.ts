/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import esbuild from 'esbuild'

export type EngineType = 'vinyl' | 'shaka'

export interface BundleLoadTime {
    engine: EngineType
    bundleSizeKB: number
    estimatedLoadTimes: {
        low: number // 500 kbps
        '3g': number // 1 Mbps
        '4g': number // 10 Mbps
        wifi: number // 50 Mbps
    }
}

const SHAKA_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.0/shaka-player.compiled.js'

/**
 * Tree-shake Vinyl down to just `createVinylPlayer` and minify, matching
 * what a real consumer would ship after bundling. Mirrors the logic used
 * by the package's analyzeExports tree-shaking report.
 */
async function getVinylMinifiedBundle(packageDir: string): Promise<Buffer> {
    const importPath = path.join(packageDir, 'dist/index.js')
    const virtualEntry = path.join(
        os.tmpdir(),
        `abrBenchmark-vinyl-${crypto.randomUUID()}.js`
    )
    fs.writeFileSync(
        virtualEntry,
        `import { createVinylPlayer } from "${importPath}";\nconsole.log(createVinylPlayer);`
    )
    try {
        const result = await esbuild.build({
            entryPoints: [virtualEntry],
            bundle: true,
            write: false,
            treeShaking: true,
            minify: true,
            format: 'esm',
            platform: 'browser',
            logLevel: 'silent',
        })
        return Buffer.from(result.outputFiles[0].contents)
    } finally {
        fs.unlinkSync(virtualEntry)
    }
}

async function getBundleSize(
    engine: EngineType,
    packageDir: string
): Promise<number> {
    switch (engine) {
        case 'vinyl': {
            const bundle = await getVinylMinifiedBundle(packageDir)
            return zlib.gzipSync(bundle).length
        }
        case 'shaka': {
            const response = await fetch(SHAKA_URL)
            const bundle = Buffer.from(await response.arrayBuffer())
            return zlib.gzipSync(bundle).length
        }
    }
}

function estimateLoadTimes(
    bundleSize: number
): BundleLoadTime['estimatedLoadTimes'] {
    return {
        low: (bundleSize / (500_000 / 8)) * 1000, // 500 kbps
        '3g': (bundleSize / (1_000_000 / 8)) * 1000, // 1 Mbps
        '4g': (bundleSize / (10_000_000 / 8)) * 1000, // 10 Mbps
        wifi: (bundleSize / (50_000_000 / 8)) * 1000, // 50 Mbps
    }
}

export async function measureBundleLoadTimes(
    engines: EngineType[],
    packageDir: string
): Promise<BundleLoadTime[]> {
    console.log('\nMeasuring bundle sizes...')
    const results: BundleLoadTime[] = []

    for (const engine of engines) {
        const bundleSize = await getBundleSize(engine, packageDir)
        const estimatedLoadTimes = estimateLoadTimes(bundleSize)
        const bundleSizeKB = Math.round(bundleSize / 1024)

        results.push({ engine, bundleSizeKB, estimatedLoadTimes })
        console.log(
            `  ${engine}: ${bundleSizeKB}KB gzipped - estimates: ` +
                `low=${Math.round(estimatedLoadTimes.low)}ms, ` +
                `3G=${Math.round(estimatedLoadTimes['3g'])}ms, ` +
                `4G=${Math.round(estimatedLoadTimes['4g'])}ms, ` +
                `WiFi=${Math.round(estimatedLoadTimes.wifi)}ms`
        )
    }

    return results
}
