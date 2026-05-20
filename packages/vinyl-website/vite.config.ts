/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vite'
import { resolve } from 'path'
import { docsPlugin } from './buildSrc/docsPlugin'
import { highlightPlugin } from './buildSrc/highlightPlugin'

export default defineConfig({
    base: './',
    root: 'src',
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: resolve(__dirname, 'src/index.html'),
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    esbuild: {
        jsxFactory: 'jsx',
        jsxFragment: 'Fragment',
    },
    plugins: [highlightPlugin(), docsPlugin(resolve(__dirname, '../..'))],
    server: {
        port: 8080,
        fs: {
            allow: [resolve(__dirname, '../..')],
        },
    },
})
