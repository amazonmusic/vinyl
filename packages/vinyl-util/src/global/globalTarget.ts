/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogTarget } from '../logging/LogTarget'

/**
 * The global path target.
 * Global systems such as logging or uncaught error handling may use this when a pathTarget
 * is needed.
 */
export const globalTarget: LogTarget = {
    logPrefix: '<global>',
}
