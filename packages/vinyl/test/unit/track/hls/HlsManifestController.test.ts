/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from '@amazon/vinyl-util'
import { Deferred } from '@amazon/vinyl-util'
import { HlsManifestControllerImpl, type HlsManifestData } from '@amazon/vinyl'
import { mockHlsManifestData } from '@amazon/vinyl/vinylTestUtil'
import {
    expectNothing,
    flushPromises,
} from '@amazon/vinyl-util/browserTestUtil'

import Spy = jasmine.Spy
import createSpy = jasmine.createSpy

describe('HlsManifestController', () => {
    let manifestProvider: Spy<
        (abort?: ReadonlyAbort) => Promise<HlsManifestData>
    >

    beforeEach(() => {
        manifestProvider = createSpy('manifestProvider')
        manifestProvider.and.resolveTo(mockHlsManifestData)
    })

    function createManifestController() {
        return new HlsManifestControllerImpl(manifestProvider)
    }

    it('has a toStringTag', () => {
        const controller = createManifestController()
        expect(String(controller)).toContain('HlsManifestControllerImpl')
    })

    it('has a logPrefix', () => {
        const controller = createManifestController()
        expect(controller.logPrefix).toBe('HlsManifestControllerImpl')
    })

    describe('refresh', () => {
        it('reloads the manifest', () => {
            const controller = createManifestController()
            controller.refresh()
            expect(manifestProvider).toHaveBeenCalledTimes(2)
        })

        it('notifies observers', () => {
            const controller = createManifestController()
            const observer = createSpy('observer')
            controller.onData(observer)
            observer.calls.reset()
            controller.refresh()
            expect(observer).toHaveBeenCalledTimes(1)
        })
    })

    describe('value', () => {
        it('resolves to the manifest data', async () => {
            const controller = createManifestController()
            const result = await controller.value
            expect(result.mainPlaylist).toBe(mockHlsManifestData.mainPlaylist)
            expect(result.baseUrl).toBe(mockHlsManifestData.baseUrl)
        })
    })

    describe('getValue', () => {
        it('returns the same as value', () => {
            const controller = createManifestController()
            expect(controller.getValue()).toBe(controller.value)
        })
    })

    describe('changeId', () => {
        it('increments when manifest is refreshed', () => {
            const controller = createManifestController()
            const initial = controller.changeId
            controller.refresh()
            expect(controller.changeId).toBe(initial + 1)
        })
    })

    describe('pick', () => {
        it('returns a sub-observable', () => {
            const controller = createManifestController()
            const thenPick = controller.pick('then')
            expect(thenPick.value).toEqual(jasmine.any(Function))
        })
    })

    describe('map', () => {
        it('returns a mapped observable', async () => {
            const controller = createManifestController()
            const mapped = controller.map(async (promise) => {
                const data = await promise
                return data.baseUrl
            })
            expect(await mapped.value).toBe(mockHlsManifestData.baseUrl)
        })
    })

    describe('disposed', () => {
        it('returns false before dispose', () => {
            const controller = createManifestController()
            expect(controller.disposed).toBe(false)
        })

        it('returns true after dispose', () => {
            const controller = createManifestController()
            controller.dispose()
            expect(controller.disposed).toBe(true)
        })
    })

    describe('value - pending', () => {
        it('resolves pending manifest', async () => {
            const deferred = new Deferred<HlsManifestData>()
            manifestProvider.and.returnValue(deferred)

            const controller = createManifestController()
            const valuePromise = controller.value
            deferred.resolve(mockHlsManifestData)
            const result = await valuePromise
            expect(result.mainPlaylist).toBe(mockHlsManifestData.mainPlaylist)
        })
    })

    describe('when manifest provider rejects', () => {
        it('does not cause an unhandled rejection', async () => {
            manifestProvider.and.rejectWith(new Error('expected'))
            createManifestController()
            await flushPromises()
            expectNothing()
        })

        it('rejects the value', async () => {
            manifestProvider.and.rejectWith(new Error('expected'))
            const controller = createManifestController()
            await expectAsync(controller.value).toBeRejectedWithError(
                'expected'
            )
        })
    })

    describe('error', () => {
        it('is null when manifest loads successfully', async () => {
            const controller = createManifestController()
            await controller.value
            expect(controller.error).toBeNull()
        })

        it('is set when manifest provider rejects', async () => {
            manifestProvider.and.rejectWith(new Error('test error'))
            const controller = createManifestController()
            await expectAsync(controller.value).toBeRejected()
            expect(controller.error).toEqual(
                jasmine.objectContaining({ message: 'test error' })
            )
        })

        it('is cleared after refresh', async () => {
            manifestProvider.and.rejectWith(new Error('test error'))
            const controller = createManifestController()
            await expectAsync(controller.value).toBeRejected()
            expect(controller.error).not.toBeNull()

            manifestProvider.and.resolveTo(mockHlsManifestData)
            controller.refresh()
            expect(controller.error).toBeNull()
        })
    })

    describe('reset', () => {
        it('refreshes manifest when there was an error', async () => {
            manifestProvider.and.rejectWith(new Error('test error'))
            const controller = createManifestController()
            await expectAsync(controller.value).toBeRejected()

            manifestProvider.and.resolveTo(mockHlsManifestData)
            controller.reset()
            expect(manifestProvider.calls.count()).toBe(2)
        })

        it('does nothing when no error occurred', () => {
            const controller = createManifestController()
            const initialCallCount = manifestProvider.calls.count()
            controller.reset()
            expect(manifestProvider.calls.count()).toBe(initialCallCount)
        })
    })

    describe('dispose', () => {
        it('aborts current request', () => {
            const deferred = new Deferred<HlsManifestData>()
            manifestProvider.and.returnValue(deferred)

            const controller = createManifestController()
            const abort = manifestProvider.calls.first()
                .args[0] as ReadonlyAbort
            controller.dispose()
            expect(abort.aborted()).toBeTrue()
        })
    })
})
