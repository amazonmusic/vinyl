/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { logDebug } from './Logger'
import type { LogTarget } from './LogTarget'

/**
 * Creates a timer that logs elapsed time when called.
 *
 * @param target - The log target
 * @param message - Message to log with the elapsed time
 * @returns Function that logs the elapsed time since creation
 */
export function logTimer(target: LogTarget, message: string): () => void {
    const start = Date.now()
    return () => {
        logDebug(target, message, `${Date.now() - start}ms`)
    }
}
