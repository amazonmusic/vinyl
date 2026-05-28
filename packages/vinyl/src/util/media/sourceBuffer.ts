/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { promise } from '@amazon/vinyl-util'
import type { Maybe } from '@amazon/vinyl-util'
import { SourceBufferError } from '../../streaming/buffering/error/SourceBufferError'
import { AbortError } from '@amazon/vinyl-util'

/**
 * Returns a promise that resolves when the given source buffer is next idle.
 * If the source buffer errs, the promise will be rejected with a {@link SourceBufferError}.
 *
 * @param sourceBuffer
 */
export function nextSourceBufferIdle(
    sourceBuffer: Maybe<SourceBuffer>
): Promise<void> {
    if (!sourceBuffer) return Promise.resolve()
    if (!sourceBuffer.updating) return Promise.resolve()
    return promise((resolve, reject) => {
        const removeListeners = () => {
            sourceBuffer.removeEventListener('error', onErred)
            sourceBuffer.removeEventListener('abort', onAborted)
            sourceBuffer.removeEventListener('update', onEnded)
        }
        const onEnded = () => {
            removeListeners()
            resolve()
        }
        const onErred = (_event: any) => {
            removeListeners()
            reject(new SourceBufferError())
        }
        const onAborted = () => {
            removeListeners()
            reject(new AbortError())
        }
        sourceBuffer.addEventListener('error', onErred)
        sourceBuffer.addEventListener('abort', onAborted)
        sourceBuffer.addEventListener('update', onEnded)
    })
}
