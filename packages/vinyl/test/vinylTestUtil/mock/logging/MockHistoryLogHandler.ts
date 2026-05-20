/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HistoryLogHandler, HistoryLogItem } from '@amazon/vinyl-util'
import { LogLevel } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<HistoryLogHandler>()
export class MockHistoryLogHandler implements HistoryLogHandler {
    logLevel: LogLevel = LogLevel.DEBUG
    maxHistorySize = 0
    history: HistoryLogItem[] = []
    clear = spyFactory('clear')
}
