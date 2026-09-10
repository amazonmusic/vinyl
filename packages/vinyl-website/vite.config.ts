/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import { resolve } from 'path'
import { docsPlugin } from './buildSrc/docsPlugin.ts'
import { highlightPlugin } from './buildSrc/highlightPlugin.ts'
import { ssgPlugin } from './buildSrc/ssgPlugin.ts'
import { BASE_PATH } from './buildSrc/siteConfig.ts'
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
            input: resolve(import.meta.dirname, 'src/index.html'),
        },
    },
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, 'src'),
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
        docsPlugin(resolve(import.meta.dirname, '../..')),
        legacy({
            targets: ['chrome >= 64', 'firefox >= 67', 'safari >= 11.1'],
        }),
        ssgPlugin(resolve(import.meta.dirname, '../..')),
    ],
    server: {
        port: 8080,
        fs: {
            allow: [resolve(import.meta.dirname, '../..')],
        },
    },
})
