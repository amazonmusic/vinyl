/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BuildOptions, OnStartResult, Plugin, PluginBuild } from 'esbuild'
import ts from 'typescript'
import fs from 'node:fs'
import {
    buildTypeDeclarations,
    type TypeDeclarationOptions,
} from '../typescript/buildTypeDeclarations'

/**
 * A plugin to emit type declarations after each build.
 *
 * @param options
 */
export function tscPlugin(options: TypeDeclarationOptions = {}): Plugin {
    return {
        name: 'TscPlugin',

        setup(build: PluginBuild): void | Promise<void> {
            // Get the config file for each entry point.
            const configPaths = getAllConfigFiles(
                build.initialOptions.entryPoints
            )

            build.onStart(async (): Promise<OnStartResult | undefined> => {
                for (const configPath of configPaths) {
                    try {
                        await buildTypeDeclarations(configPath, options)
                    } catch (e: any) {
                        return {
                            errors: [
                                {
                                    text: e.message,
                                    location: { file: configPath },
                                },
                            ],
                        }
                    }
                }
            })
        },
    }
}

/**
 * Returns the tsconfig locations for the list of ESBuild entry points.
 *
 * @param entryPoints
 */
function getAllConfigFiles(
    entryPoints?: BuildOptions['entryPoints']
): readonly string[] {
    if (!entryPoints) return []
    let allInputs: string[]
    if (Array.isArray(entryPoints)) {
        allInputs = entryPoints.map((entryPoint) => {
            return typeof entryPoint === 'string' ? entryPoint : entryPoint.in
        })
    } else {
        allInputs = Object.values(entryPoints)
    }
    allInputs = Array.from(new Set(allInputs)) // Return only unique tsconfig locations.
    return allInputs
        .map((input) => ts.findConfigFile(input, fs.existsSync))
        .filter((value): value is string => value != null)
}
