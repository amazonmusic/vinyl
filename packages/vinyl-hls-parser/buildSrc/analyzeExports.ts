/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyzeExports } from '@amazon/vinyl-build-utils'

analyzeExports({
    name: 'vinyl-hls-parser',
    target: 'dist/index.js',
}).catch(console.error)
