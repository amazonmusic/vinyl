/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TypeDeclarationOptions } from '../typescript/buildTypeDeclarations'

export const vinylDefaultTscOptions: TypeDeclarationOptions = {
    downlevel: {
        // 4.7 must be included; typescript started supporting 'exports' in package.json at 4.7
        versions: ['3.7', '4.1', '4.7'],
        out: '{OUT_DIR}/../ts{VERSION}',
    },
}
