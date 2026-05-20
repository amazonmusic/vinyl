/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Plugin, PluginBuild } from 'esbuild'
import { compatTransform } from '../babel/compatTransform'
import path from 'path'
import { logger } from '../util/Logger'

export interface CompatTransformPluginOptions {
    readonly enabled?: boolean
}

/**
 * Changes a path's file extension.
 */
function changeExtension(filePath: string, newExtension: string) {
    const dir = path.dirname(filePath)
    const ext = path.extname(filePath)
    const base = path.basename(filePath, ext)
    return path.join(dir, base) + '.' + newExtension
}

export function compatTransformPlugin(
    options: CompatTransformPluginOptions = {}
): Plugin {
    return {
        name: 'CompatTransformPlugin',

        setup(build: PluginBuild): void {
            build.onEnd(async (result) => {
                if (options.enabled === false || result.errors.length) return

                if (!result.metafile) {
                    return {
                        errors: [
                            {
                                text: 'CompatTransformPlugin requires metafile: true',
                            },
                        ],
                    }
                }

                const jsOutputs = Object.keys(result.metafile.outputs).filter(
                    (f) => /\.([cm])?js$/i.test(f)
                )

                await Promise.all(
                    jsOutputs.map(async (srcPath) => {
                        const destPath = changeExtension(srcPath, 'es5.js')

                        logger.debug(
                            `babel: transpiling '${srcPath}' -> '${destPath}' ...`
                        )

                        try {
                            await compatTransform({
                                src: srcPath,
                                dest: destPath,
                            })
                            logger.info(`babel: '${destPath}'`)
                        } catch (e: any) {
                            return {
                                errors: [
                                    {
                                        text: `babel failed: ${e}`,
                                        location: { file: srcPath },
                                        detail: e,
                                    },
                                ],
                            }
                        }
                    })
                )
            })
        },
    }
}
