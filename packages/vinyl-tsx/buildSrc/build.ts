/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildVinylPackage } from '@amazon/vinyl-build-utils'

buildVinylPackage({
    serverOptions: {
        http: { port: 9000 },
        staticDir: './dist/test',
        addressInUseAutoIncrement: true,
    },
})
