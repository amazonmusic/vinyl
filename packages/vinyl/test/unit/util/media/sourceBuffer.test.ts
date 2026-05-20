/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { nextSourceBufferIdle, SourceBufferError } from '@amazon/vinyl'
import { AbortError } from '@amazon/vinyl-util'
import {
    type EventFakesHandle,
    implementEventFakes,
    mockEvent,
    MockSourceBuffer,
} from '@amazon/vinyl-util/browserTestUtil'

describe('nextSourceBufferIdle', () => {
    let mockSourceBuffer: MockSourceBuffer
    let mockSourceBufferEventFakes: EventFakesHandle

    beforeEach(() => {
        mockSourceBuffer = new MockSourceBuffer()
        mockSourceBufferEventFakes = implementEventFakes(mockSourceBuffer)
    })

    it('resolves immediately if sourceBuffer is null', async () => {
        await expectAsync(nextSourceBufferIdle(null)).toBeResolved()
    })

    it('resolves immediately if sourceBuffer is not updating', async () => {
        await expectAsync(nextSourceBufferIdle(mockSourceBuffer)).toBeResolved()
    })

    it('resolves when update event is emitted', async () => {
        mockSourceBuffer.updating = true
        const promise = nextSourceBufferIdle(mockSourceBuffer)
        mockSourceBuffer.dispatchEvent(mockEvent('update'))
        await expectAsync(promise).toBeResolved()
        expect(mockSourceBufferEventFakes.hasAnyListeners()).toBeFalse()
    })

    it('rejects with SourceBufferError when an error event is emitted', async () => {
        mockSourceBuffer.updating = true
        const promise = nextSourceBufferIdle(mockSourceBuffer)
        mockSourceBuffer.dispatchEvent(mockEvent('error'))
        await expectAsync(promise).toBeRejectedWithError(SourceBufferError)
        expect(mockSourceBufferEventFakes.hasAnyListeners()).toBeFalse()
    })

    it('rejects with an AbortError when abort event is emitted', async () => {
        mockSourceBuffer.updating = true
        const promise = nextSourceBufferIdle(mockSourceBuffer)
        mockSourceBuffer.dispatchEvent(mockEvent('abort'))
        await expectAsync(promise).toBeRejectedWith(new AbortError())
        expect(mockSourceBufferEventFakes.hasAnyListeners()).toBeFalse()
    })
})
