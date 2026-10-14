/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { vinylDefaultBrowserStackOptions } from '@amazon/vinyl-build-utils'
import { runLocalBrowsersAndExit } from '@amazon/vinyl-browserstack'

runLocalBrowsersAndExit({
    server: vinylDefaultBrowserStackOptions.server,
    queryParams: vinylDefaultBrowserStackOptions.worker.queryParams,
})
