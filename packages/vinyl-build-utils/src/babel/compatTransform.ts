/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BabelFileResult, TransformOptions } from '@babel/core'
import { transformFile } from '@babel/core'
import fs from 'node:fs'

export interface CompatTransformOptions {
    /**
     * The modern esm module to transform.
     */
    readonly src: string

    /**
     * The destination es5 js file.
     */
    readonly dest: string
    readonly options?: TransformOptions
}

const defaultTransformOptions = {
    presets: ['@babel/preset-env'],
    minified: true,
    sourceType: 'unambiguous',
} as const satisfies TransformOptions

/**
 * Transforms a source file to a destination ES5 target.
 * Use the compatTransformPlugin for ESBuild integration.
 *
 * @param options
 */
export async function compatTransform(
    options: CompatTransformOptions
): Promise<void> {
    if (!fs.existsSync(options.src)) {
        throw new Error(`babel: src missing`)
    }
    // Currently does not handle source map chaining.
    const result = await new Promise<BabelFileResult | null>(
        (resolve, reject) => {
            transformFile(
                options.src,
                options.options ?? defaultTransformOptions,
                (err, result) => {
                    if (err) reject(err)
                    else resolve(result)
                }
            )
        }
    )

    // Write the transformed code to a new file

    const code = result?.code
    if (code) {
        await new Promise((resolve, reject) => {
            fs.writeFile(options.dest, code, 'utf8', (err) => {
                if (err) reject(err)
                else resolve(void 0)
            })
        })
    } else {
        throw new Error(`babel: transpile failed`)
    }
}
