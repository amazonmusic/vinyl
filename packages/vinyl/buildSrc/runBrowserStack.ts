/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { vinylDefaultBrowserStackOptions } from '@amazon/vinyl-build-utils'
import { runSeleniumBrowserStackAndExit } from '@amazon/vinyl-browserstack'
import packageJson from '../package.json' with { type: 'json' }
import { APPEND_MODE_VARIANTS } from './appendModeVariants.ts'

runSeleniumBrowserStackAndExit({
    ...vinylDefaultBrowserStackOptions,
    workerCommon: {
        ...vinylDefaultBrowserStackOptions.workerCommon,
        project: packageJson.name,
    },
    queryParamVariants: APPEND_MODE_VARIANTS,
})
