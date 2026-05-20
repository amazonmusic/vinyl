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
            entryPoints: ['test/hlsTestAssets/index.ts'],
            ...commonVinylBuildOptions,
            plugins: [tsc],
            outfile: 'dist/hlsTestAssets/index.js',
        },
    ],
})
