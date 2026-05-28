/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogEventMap, Logger, LogTarget } from '@amazon/vinyl-util'
import { loggerRef, LogLevel } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { overrideGlobalInit } from '../../global/overrideGlobalInit'
import { MockEventHost } from '../event/MockEventHost'
import createSpy = jasmine.createSpy

type LogFilterFun = (target: LogTarget, ...messages: any[]) => void

const spyFactory = createSpyFactory<Logger>()
export class MockLogger extends MockEventHost<LogEventMap> implements Logger {
    logLevel: LogLevel = LogLevel.DEBUG

    log = spyFactory('log').and.callFake((target, level, ...messages) => {
        switch (level) {
            // Delegates logs to spies separated by log level.
            case LogLevel.VERBOSE:
                this.verbose(target, ...messages)
                break
            case LogLevel.DEBUG:
                this.debug(target, ...messages)
                break
            case LogLevel.INFO:
                this.info(target, ...messages)
                break
            case LogLevel.WARN:
                this.warn(target, ...messages)
                break
            case LogLevel.ERROR:
                this.error(target, ...messages)
                break
        }
    })

    verbose = createSpy<LogFilterFun>('verbose')
    debug = createSpy<LogFilterFun>('debug')
    info = createSpy<LogFilterFun>('info')
    warn = createSpy<LogFilterFun>('warn')
    error = createSpy<LogFilterFun>('error')
}

export function useMockLogger(): { readonly value: MockLogger } {
    return overrideGlobalInit(loggerRef, () => new MockLogger())
}
