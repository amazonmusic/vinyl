/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { vinylDefaultBrowserStackOptions } from '@amazon/vinyl-build-utils'
import { runLocalBrowsersAndExit } from '@amazon/vinyl-browserstack'
import { APPEND_MODE_VARIANTS } from './appendModeVariants.ts'

runLocalBrowsersAndExit({
    server: vinylDefaultBrowserStackOptions.server,
    queryParams: vinylDefaultBrowserStackOptions.worker.queryParams,
    queryParamVariants: APPEND_MODE_VARIANTS,
})
