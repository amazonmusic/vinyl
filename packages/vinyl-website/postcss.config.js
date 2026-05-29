/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import postcssPresetEnv from 'postcss-preset-env'
import autoprefixer from 'autoprefixer'

export default {
    plugins: [postcssPresetEnv({ stage: 3 }), autoprefixer()],
}
