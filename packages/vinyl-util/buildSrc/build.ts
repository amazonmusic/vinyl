/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    buildVinylPackage,
    commonVinylBuildOptions,
    tscPlugin,
    vinylDefaultTscOptions,
} from '@amazon/vinyl-build-utils'

const tsc = tscPlugin(vinylDefaultTscOptions)

buildVinylPackage({
    buildOptions: [
        {
            entryPoints: ['test/browserTestUtil/index.ts'],
            ...commonVinylBuildOptions,
            plugins: [tsc],
            outfile: 'dist/browserTestUtil/index.js',
        },
        {
            entryPoints: ['test/testUtil/index.ts'],
            ...commonVinylBuildOptions,
            plugins: [tsc],
            outfile: 'dist/testUtil/index.js',
        },
        {
            entryPoints: ['polyfill/index.ts'],
            ...commonVinylBuildOptions,
            format: 'iife',
            // no need to downlevel polyfill, don't use vinylDefaultTscOptions
            plugins: [tscPlugin()],
            outfile: 'dist/polyfill/index.js',
        },
    ],
})
