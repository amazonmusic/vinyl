/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import noSelfImport from './noSelfImport.mjs'
import licenseHeader from './licenseHeader.mjs'

/** @type {import('oxlint').Plugin} */
export default {
    meta: {
        name: 'custom-rules',
    },
    rules: {
        'no-self-import': noSelfImport,
        'license-header': licenseHeader,
    },
}
