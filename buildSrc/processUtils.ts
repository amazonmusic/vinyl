/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExecSyncOptionsWithBufferEncoding } from 'child_process'
import { execSync } from 'node:child_process'
import process from 'node:process'

/**
 * Executes a synchronous command, piping the std out.
 *
 * @param command
 * @param options
 */
export function cmd(
    command: string,
    options?: ExecSyncOptionsWithBufferEncoding
) {
    console.log('> ' + command)
    return execSync(command, {
        stdio: ['pipe', process.stdout, process.stderr],
        ...options,
    })
}
