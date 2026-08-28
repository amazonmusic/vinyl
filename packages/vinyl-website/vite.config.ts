/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import { resolve } from 'path'
import { docsPlugin } from './buildSrc/docsPlugin'
import { highlightPlugin } from './buildSrc/highlightPlugin'
import { ssgPlugin } from './buildSrc/ssgPlugin'
import { BASE_PATH } from './buildSrc/siteConfig'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
    // Served under a base path (default /vinyl/); absolute so nested static
    // routes (e.g. /docs/<slug>/) resolve assets. Override with BASE_PATH env.
    base: BASE_PATH,
    root: 'src',
    publicDir: '../public',
    define: {
        'globalThis.__VINYL_VERSION__': JSON.stringify(packageJson.version),
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rolldownOptions: {
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
    plugins: [
        highlightPlugin(),
        docsPlugin(resolve(__dirname, '../..')),
        legacy({
            targets: ['chrome >= 64', 'firefox >= 67', 'safari >= 11.1'],
        }),
        ssgPlugin(resolve(__dirname, '../..')),
    ],
    server: {
        port: 8080,
        fs: {
            allow: [resolve(__dirname, '../..')],
        },
    },
})
