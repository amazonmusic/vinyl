/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeLogging } from '@amazon/vinyl-util'
import { vinylGlobalRef } from './globalRef'

export function initializeVinylGlobal() {
    initializeLogging()
    vinylGlobalRef.initialize()
}
