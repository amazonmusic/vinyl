/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import ts from 'typescript'
import type { ParsedCommandLine } from 'typescript'
import path from 'node:path'

export interface TsProjectConfig {
    /**
     * The path to the config.
     */
    readonly configFile: string

    /**
     * The json resolved into a command line config.
     */
    readonly parsed: ParsedCommandLine
}

const cachedTsConfigs = new Map<string, TsProjectConfig>()

export function parseTsConfig(configFile: string): TsProjectConfig {
    if (cachedTsConfigs.has(configFile)) return cachedTsConfigs.get(configFile)!
    const { config, error } = ts.readConfigFile(
        configFile,
        ts.sys.readFile.bind(ts.sys)
    )
    if (error)
        throw new Error(
            typeof error.messageText === 'string'
                ? error.messageText
                : error.messageText.messageText
        )

    const parsedCommandLine = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(configFile)
    )
    const result = {
        configFile,
        parsed: parsedCommandLine,
    }
    cachedTsConfigs.set(configFile, result)
    return result
}
