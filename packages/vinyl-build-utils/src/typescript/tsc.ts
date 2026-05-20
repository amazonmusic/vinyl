/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import ts, { type BuildOptions, ExitStatus } from 'typescript'

export type TscBuildOptions = BuildOptions

let pending: Promise<ExitStatus> = Promise.resolve(ExitStatus.Success)

/**
 * Runs the typescript compiler for the given project.
 * Supports project references.
 *
 * Note - the Typescript compiler is (unfortunately) synchronous, while this
 * method returns a Promise, the build portion will make this a long-running task.
 * When combined with the ESBuild `buildAll`, tsc can be run in parallel by invoking tsc after buildAll.
 *
 * @param configFile
 * @param options
 */
export async function tsc(
    configFile: string,
    options: TscBuildOptions = {}
): Promise<ExitStatus> {
    pending = pending.then(() => {
        const host = ts.createSolutionBuilderHost()
        const builder = ts.createSolutionBuilder(host, [configFile], options)
        const status = builder.buildReferences(configFile)
        if (status !== ExitStatus.Success) return status
        return builder.build()
    })
    return pending
}
