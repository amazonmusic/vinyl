/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

let loggingUncaughtErrors = false

/**
 * Logs uncaught errors and promise rejections to the console, to be emitted to the report api.
 * Jasmine catches uncaught errors and only reports the message in the test failure, not the whole error event.
 */
export function initializeUncaughtErrorLogging() {
    if (loggingUncaughtErrors) return
    loggingUncaughtErrors = true
    window.addEventListener('error', (event) => {
        console.error('uncaught error event:', event)
    })

    window.addEventListener('unhandledrejection', (event) => {
        console.error('unhandled rejection:', event)
    })
}
