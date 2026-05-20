/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type SegmentDataProvider,
    SegmentDataSlot,
    SegmentStatus,
} from '@amazon/vinyl'
import { AbortError, Deferred, withAbort } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy
import any = jasmine.any

describe('SegmentDataSlot', () => {
    let mockRequestSegment: Spy<SegmentDataProvider>
    let slot: SegmentDataSlot

    beforeEach(() => {
        mockRequestSegment = createSpy('requestSegment')
        slot = new SegmentDataSlot(mockRequestSegment)
    })

    it('initializes with an INACTIVE status', () => {
        expect(slot.status).toEqual(SegmentStatus.INACTIVE)
    })

    it('calls onStatusChange when status changes', async () => {
        const segmentPromise = new Deferred<ArrayBuffer>()
        mockRequestSegment.and.returnValue(segmentPromise)
        const statusChangeSpy = createSpy('statusChange')
        slot.onStatusChange = statusChangeSpy
        const requestPromise = slot.request()
        expect(statusChangeSpy).toHaveBeenCalledOnceWith()
        statusChangeSpy.calls.reset()
        segmentPromise.resolve(new ArrayBuffer(0))
        await requestPromise
        expect(statusChangeSpy).toHaveBeenCalledOnceWith()
    })

    describe('request', () => {
        it('sets status to PENDING when request is made and RESOLVED on success', async () => {
            mockRequestSegment.and.resolveTo(new ArrayBuffer(0))
            const promise = slot.request()
            expect(slot.status).toEqual(SegmentStatus.PENDING)
            await promise
            expect(slot.status).toEqual(SegmentStatus.RESOLVED)
        })

        it('sets status to ERRED on failed request', async () => {
            mockRequestSegment.and.rejectWith(new Error('Failed to load'))
            await expectAsync(slot.request()).toBeRejectedWithError(
                'Failed to load'
            )
            expect(slot.status).toEqual(SegmentStatus.ERRED)
        })

        it('resets to inactive on silent error', async () => {
            mockRequestSegment.and.rejectWith(new AbortError())
            await expectAsync(slot.request()).toBeRejectedWith(new AbortError())
            expect(slot.status).toEqual(SegmentStatus.INACTIVE)
            mockRequestSegment.and.resolveTo(new ArrayBuffer(0))
            await expectAsync(slot.request()).toBeResolvedTo(any(ArrayBuffer))
        })
    })

    describe('clear', () => {
        it('aborts the request and resets the status to INACTIVE when cleared', async () => {
            mockRequestSegment.and.callFake((abort) => {
                return withAbort(new Deferred(), abort)
            })
            const promise = slot.request()
            slot.clear()
            expect(slot.status).toEqual(SegmentStatus.INACTIVE)
            await expectAsync(promise).toBeRejectedWith(any(AbortError))
        })

        it('does nothing if already INACTIVE', () => {
            slot.clear()
            expect(slot.status).toEqual(SegmentStatus.INACTIVE)
        })
    })

    describe('dispose', () => {
        it('clears the segment and remove the status change handler', () => {
            slot.onStatusChange = createSpy('statusChange')
            slot.dispose()
            expect(slot.onStatusChange).toBeNull()
            expect(slot.status).toEqual(SegmentStatus.INACTIVE)
        })
    })
})
