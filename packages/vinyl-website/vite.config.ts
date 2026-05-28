/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vite'
import { resolve } from 'path'
import { docsPlugin } from './buildSrc/docsPlugin'
import { highlightPlugin } from './buildSrc/highlightPlugin'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
    base: './',
    root: 'src',
    publicDir: '../public',
    define: {
        'globalThis.__VINYL_VERSION__': JSON.stringify(packageJson.version),
    },
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
        conditions: ['development'],
    },
    oxc: {
        jsx: {
            runtime: 'classic',
            pragma: 'jsx',
            pragmaFrag: 'Fragment',
        },
    },
    plugins: [highlightPlugin(), docsPlugin(resolve(__dirname, '../..'))],
    server: {
        port: 8080,
        fs: {
            allow: [resolve(__dirname, '../..')],
        },
    },
})
