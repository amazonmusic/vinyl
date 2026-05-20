/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    consoleLogHandler,
    historyLogHandler,
    LogLevel,
    type PartialDeep,
    setLogLevel,
} from '@amazon/vinyl-util'
import type { ValueSchema } from '@amazon/vinyl-validation'
import {
    isOneOf,
    number,
    object,
    type ObjectSchema,
} from '@amazon/vinyl-validation'
import { PlayerRegistryImpl, playerRegistryRef } from './PlayerRegistry'

/**
 * Configuration for VinylGlobal.
 */
export interface VinylGlobalOptions {
    /**
     * The number of concurrent players before a warning is logged.
     * default: 5
     */
    readonly maxPlayersWarning: number

    /**
     * Logging configuration
     */
    readonly logging: {
        readonly history: {
            /**
             * Limits the history log level.
             */
            readonly logLevel: LogLevel

            /**
             * Sets the logging history size.
             */
            readonly maxHistorySize: number
        }

        /**
         * Gates all log handlers to logs of at least this level.
         */
        readonly logLevel: LogLevel

        readonly console: {
            /**
             * Gates console logs
             */
            readonly logLevel: LogLevel
        }
    }
}

const logLevelValidator: ValueSchema<LogLevel> = (() =>
    isOneOf(
        LogLevel.VERBOSE,
        LogLevel.DEBUG,
        LogLevel.INFO,
        LogLevel.WARN,
        LogLevel.ERROR,
        LogLevel.NONE
    ))()

/**
 * A validator for VinylGlobalOptions applications can set for Vinyl.
 */
const vinylGlobalOptionsValidator: ObjectSchema<VinylGlobalOptions> = object({
    logging: object({
        console: object({
            logLevel: logLevelValidator,
        }),
        history: object({
            logLevel: logLevelValidator,
            maxHistorySize: number(),
        }),
        logLevel: logLevelValidator,
    }),
    maxPlayersWarning: number(),
})

const vinylGlobalOptionsPartialValidator: ObjectSchema<
    PartialDeep<VinylGlobalOptions>
> = vinylGlobalOptionsValidator.partialDeep()

/**
 * Applies configuration to the current vinyl global options.
 *
 * @param options
 */
export function configureVinylGlobal(options: PartialDeep<VinylGlobalOptions>) {
    vinylGlobalOptionsPartialValidator.assert(options)
    // Logging configuration
    if (options.logging) {
        const logging = options.logging
        if (logging.logLevel != null) setLogLevel(logging.logLevel)
        if (logging.history) {
            const history = logging.history
            if (historyLogHandler.value) {
                if (history.maxHistorySize != null)
                    historyLogHandler.value.maxHistorySize =
                        history.maxHistorySize
                if (history.logLevel != null)
                    historyLogHandler.value.logLevel = history.logLevel
            }
        }
        if (logging.console?.logLevel != null) {
            if (consoleLogHandler.value) {
                consoleLogHandler.value.logLevel = logging.console.logLevel
            }
        }
    }

    if (
        options.maxPlayersWarning != null &&
        playerRegistryRef.value instanceof PlayerRegistryImpl
    ) {
        playerRegistryRef.value.maxPlayersWarning = options.maxPlayersWarning
    }
}
