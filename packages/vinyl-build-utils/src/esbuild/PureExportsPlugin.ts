/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Loader, OnLoadArgs, OnLoadResult, Plugin } from 'esbuild'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import { parse } from '@babel/parser'
import type * as t from '@babel/types'
import MagicString from 'magic-string'
import { type NodePath, traverse } from '@babel/core'

/**
 * Adds a PURE annotation to call expressions and `new` expressions
 * inside object literals that are not within any function-like scope.
 * This allows exported config-like structures to be tree-shaken safely
 * when not referenced.
 */
export const pureExportsPlugin: Plugin = {
    name: 'pure-exports',
    setup(build) {
        build.onLoad({ filter: /\.[jt]sx?$/ }, onLoad)
    },
}

export async function onLoad(args: OnLoadArgs): Promise<OnLoadResult | null> {
    const source = await readFile(args.path, 'utf8')
    return {
        contents: annotatePureComments(source),
        loader: extname(args.path).slice(1) as Loader,
    }
}

export function annotatePureComments(source: string): string {
    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        ranges: true,
    })

    const ms = new MagicString(source)

    traverse(ast, {
        CallExpression(path) {
            maybeAnnotate(path, ms)
        },
        NewExpression(path) {
            maybeAnnotate(path, ms)
        },
    })

    return ms.toString()
}

function maybeAnnotate(
    path: NodePath<t.CallExpression | t.NewExpression>,
    ms: MagicString
) {
    const { node } = path
    if (node.start == null) return

    // Disallow annotation if the object literal is within any function-like scope
    if (path.findParent((p) => p.isFunctionParent())) return

    // Annotate as PURE
    ms.prependLeft(node.start, '/* @__PURE__ */ ')
}
