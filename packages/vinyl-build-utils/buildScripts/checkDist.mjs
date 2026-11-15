/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Checks that the package in the current directory loads in plain Node.js from
// its published entry point. The repository's .npmrc adds the 'development'
// condition to npm scripts, which resolves packages to their TypeScript
// sources, so the import runs in a child process without it.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { name } = JSON.parse(readFileSync('package.json', 'utf8'))
const env = { ...process.env }
delete env.NODE_OPTIONS
execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(name)})`],
    { env, stdio: 'inherit' }
)
console.log(`${name} loads in Node.js`)
