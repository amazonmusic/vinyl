/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { toastError } from './components/toast'

export function handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    toastError(message)
}

export function createErrorHandler(): (error: unknown) => void {
    return handleError
}

window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason)
})
