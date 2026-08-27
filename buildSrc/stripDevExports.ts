/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Removes the dev-only "development" export condition from each package's
// package.json before publishing. The `development` condition (written by
// writePackageJsonExports.ts) points at TS source under ./src so in-monorepo
// builds resolve cross-package imports to source. Published tarballs ship only
// `dist`, so leaving `development` in lets a consumer that bundles with
// esbuild `conditions: ['development']` resolve to source that isn't there and
// fail (`Could not resolve "./src/index.ts"`). Stripping it makes such
// consumers fall through to the "import"/"require" conditions -> ./dist.
//
// This mutates package.json in place. Run it only on a throwaway publish
// checkout (CI), immediately before `lerna publish`; the working tree keeps
// `development` for local source builds.
//
// Usage: tsx ./buildSrc/stripDevExports.ts

import { glob } from 'glob'
import fs from 'node:fs'

// Recursively delete any "development" key within an exports subtree.
function stripDevelopment(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false
    let changed = false
    for (const [key, value] of Object.entries(
        node as Record<string, unknown>
    )) {
        if (key === 'development') {
            delete (node as Record<string, unknown>)[key]
            changed = true
        } else if (stripDevelopment(value)) {
            changed = true
        }
    }
    return changed
}

function stripDevExports() {
    for (const file of glob.sync('packages/*/package.json')) {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
        if (pkg.exports && stripDevelopment(pkg.exports)) {
            fs.writeFileSync(file, JSON.stringify(pkg, null, 4) + '\n')
            console.log(`Stripped development exports from ${file}`)
        }
    }
}

stripDevExports()
