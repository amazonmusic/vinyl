/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalRef } from '../global/globalRegistry'
import type { ConsoleLogHandler } from './ConsoleLogHandler'
import { ConsoleLogHandlerImpl } from './ConsoleLogHandler'
import type { HistoryLogHandler } from './HistoryLogHandler'
import { HistoryLogHandlerImpl } from './HistoryLogHandler'
import { loggerRef } from './Logger'
import { getLogLevelFromSearch } from './getLogLevelFromSearch'

export const historyLogHandler = globalRef(
    (): HistoryLogHandler | undefined => {
        return new HistoryLogHandlerImpl(loggerRef.value)
    }
)

export const consoleLogHandler = globalRef(
    (): ConsoleLogHandler | undefined => {
        return new ConsoleLogHandlerImpl(
            loggerRef.value,
            getLogLevelFromSearch()
        )
    }
)

/**
 * Initializes vinyl logging.
 */
export function initializeLogging() {
    historyLogHandler.initialize()
    consoleLogHandler.initialize()
}
