/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    runBrowserStackAndExit,
    vinylDefaultBrowserStackOptions,
} from '@amazon/vinyl-build-utils'
import packageJson from '../package.json' with { type: 'json' }

runBrowserStackAndExit({
    ...vinylDefaultBrowserStackOptions,
    workerCommon: {
        ...vinylDefaultBrowserStackOptions.workerCommon,
        project: packageJson.name,
    },
})
