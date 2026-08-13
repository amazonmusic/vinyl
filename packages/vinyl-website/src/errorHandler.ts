/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { toastError } from './components/toast'
import { isSilentError } from '@amazon/vinyl-util'

export function handleError(error: unknown): void {
    if (isSilentError(error)) return
    const message = error instanceof Error ? error.message : String(error)
    toastError(message)
}

window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason)
})
