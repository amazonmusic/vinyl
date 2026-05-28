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
import packageJson from '../package.json' with { type: 'json' }

const tsc = tscPlugin(vinylDefaultTscOptions)

buildVinylPackage({
    commonOptions: {
        define: {
            'globalThis.__VINYL_VERSION__': JSON.stringify(packageJson.version),
        },
    },
    buildOptions: [
        {
            entryPoints: ['test/vinylTestUtil/index.ts'],
            ...commonVinylBuildOptions,
            plugins: [tsc],
            outfile: 'dist/vinylTestUtil/index.js',
        },
    ],
    serverOptions: {
        http: { port: 9000 },
        staticDir: './dist/test',
        addressInUseAutoIncrement: true,
    },
})
