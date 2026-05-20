/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs'
import path from 'node:path'

export function getRootProjectDir(dir: string = process.cwd()): string | null {
    const packageJsonPath = path.join(dir, 'package.json')
    const found = fs.existsSync(packageJsonPath) ? dir : null
    const parentDir = path.resolve(dir, '..')
    if (parentDir === dir) return found // File system root
    return getRootProjectDir(parentDir) ?? found
}
