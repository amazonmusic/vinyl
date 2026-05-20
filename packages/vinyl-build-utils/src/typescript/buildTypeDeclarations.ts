/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExitStatus } from 'typescript'
import path from 'node:path'
import { tsc, type TscBuildOptions } from './tsc'
import { replacePathAliases } from './replacePathAliases'
import { downlevelDts } from '@nbilyk/downlevel-dts'
import { logger } from '../util/Logger'
import { parseTsConfig } from './parseTsConfig'

export interface TypeDeclarationOptions {
    /**
     * Configuration for the typescript compiler.
     */
    readonly tsc?: TscBuildOptions

    /**
     * If true (default), will replace path aliases in declaration files.
     */
    readonly replacePathAliases?: boolean

    /**
     * If set, type declarations (d.ts) files will be downleveled from the current
     * TypeScript version to be compatible with older variants.
     * Internally, a fork of downlevel dts is used.
     */
    readonly downlevel?: DownlevelOptions
}

export interface DownlevelOptions {
    /**
     * A list of versions to downlevel the declarations to.
     */
    readonly versions: string[]

    /**
     * The output path for down-leveled declarations.
     * Must contain `{VERSION}` token string.
     * May contain `{OUT_DIR}` token string to use the resolved out directory.
     *
     * Example: '{OUT_DIR}/../ts{VERSION}'
     */
    readonly out: string
}

/**
 * Runs tsc to build type declarations, replaces path aliases, and downlevels declarations.
 *
 * @param configPath
 * @param options
 */
export async function buildTypeDeclarations(
    configPath: string,
    options: TypeDeclarationOptions
): Promise<void> {
    const absPath = path.resolve(configPath)
    logger.info(`tsc: starting '${absPath}'`)

    const { parsed } = parseTsConfig(absPath)
    const configOpts = parsed.options

    const status = await tsc(configPath, options.tsc)
    if (status !== ExitStatus.Success) {
        throw new TypeDeclarationsError(`tsc failed`, configPath)
    }

    if ((options.replacePathAliases ?? true) && configOpts.outDir) {
        logger.debug(`tsc: replace path aliases for config '${absPath}'`)
        try {
            await replacePathAliases({
                configFile: configPath,
                debug: options.tsc?.verbose ?? false,
            })
        } catch (e: any) {
            throw new TypeDeclarationsError(
                `tsc-alias failed: ${e}`,
                configPath,
                e
            )
        }
        logger.debug(`tsc: replacePathAliases for ${absPath} done`)
    }
    if (
        options.downlevel &&
        configOpts.outDir &&
        !configOpts.noEmit &&
        configOpts.declaration
    ) {
        const target = options.downlevel.out.replace(
            '{OUT_DIR}',
            configOpts.outDir
        )
        logger.debug(`tsc: down-leveling: ${configOpts.outDir} to ${target}`)
        downlevelDts({
            src: configOpts.outDir,
            target,
            targetVersion: options.downlevel.versions,
        })
    }

    logger.debug(`tsc done: '${configPath}'`)
}

/**
 * An error related to building type declarations.
 */
export class TypeDeclarationsError extends Error {
    constructor(
        message: string,
        readonly location: string,
        readonly detail?: Error
    ) {
        super(message)
    }
}
