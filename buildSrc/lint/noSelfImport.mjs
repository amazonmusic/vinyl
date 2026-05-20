/*
 * Copyright (c) 2024. Amazon.com, Inc. or its affiliates. All rights reserved.
 */

// Disallows incorrectly importing the self containing module.

import path from 'node:path'
import fs from 'node:fs'

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'disallow importing self project',
            category: 'Static analysis',
            recommended: true,
        },
        schema: [],
    },

    create(context) {
        // This solution is not very general, it's a naive approach that relies on the containing tsconfig.json
        // directory has the same name as the final module.
        const tsConfigDir = getTsConfigDir(context.getFilename())
        let projectDir = path.basename(tsConfigDir)
        if (projectDir === 'src')
            // Move up one more directory.
            projectDir = path.basename(path.resolve(tsConfigDir, '..'))

        return {
            ImportDeclaration(node) {
                if (!node.source.value.startsWith('@')) return
                const importDir = path.basename(node.source.value)
                if (importDir === projectDir) {
                    context.report({
                        node,
                        message:
                            'Importing the containing project itself is not allowed. Did you mean to use a @/ path alias?',
                    })
                }
            },
        }
    },
}

/**
 * Gets the directory of the first parent directory with a tsconfig.
 *
 * @param {string} dir
 * @return {string|null}
 */
function getTsConfigDir(dir) {
    if (fs.existsSync(path.join(dir, 'tsconfig.json'))) return dir
    const parentDir = path.resolve(dir, '..')
    if (parentDir === dir) return null
    return getTsConfigDir(parentDir)
}
