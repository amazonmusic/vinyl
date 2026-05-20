/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseVersion } from '@amazon/vinyl-util'

/**
 * process.env.VINYL_VERSION will be null in node unit tests, but in the built library it is
 * replaced by the webpack DefinePlugin with the package.version.
 */
export const vinylVersion = parseVersion(
    /* istanbul ignore next */
    process.env.VINYL_VERSION ?? '0.0.0.0'
)
