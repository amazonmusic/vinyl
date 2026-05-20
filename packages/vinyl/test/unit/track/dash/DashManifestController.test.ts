/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Abort, ReadonlyAbort } from '@amazon/vinyl-util'
import { Deferred } from '@amazon/vinyl-util'
import {
    type DashManifestData,
    DashManifestControllerImpl,
} from '@amazon/vinyl'
import { mockDashManifest } from '@amazon/vinyl/vinylTestUtil'
import {
    expectNothing,
    flushPromises,
} from '@amazon/vinyl-util/browserTestUtil'

import Spy = jasmine.Spy
import createSpy = jasmine.createSpy

describe('DashManifestController', () => {
    let manifestProvider: Spy<
        (abort?: ReadonlyAbort) => Promise<DashManifestData>
    >

    beforeEach(() => {
        manifestProvider = createSpy('manifestProvider')
        manifestProvider.and.resolveTo({
            manifest: mockDashManifest,
            baseUrl: 'https://example.com',
        })
    })

    function createManifestController() {
        return new DashManifestControllerImpl({
            manifestProvider,
        })
    }

    it('has a toStringTag', () => {
        const manifestController = createManifestController()
        expect(String(manifestController)).toContain(
            'DashManifestControllerImpl'
        )
    })

    it('has a logPrefix', () => {
        const manifestController = createManifestController()
        expect(manifestController.logPrefix).toBe('DashManifestControllerImpl')
    })

    describe('refresh', () => {
        it('reloads the manifest', () => {
            const manifestController = createManifestController()
            manifestController.refresh()
            expect(manifestProvider).toHaveBeenCalledTimes(2)
        })

        it('notifies observers', () => {
            const manifestController = createManifestController()
            const observer = createSpy('observer')
            manifestController.onData(observer)
            observer.calls.reset()
            manifestController.refresh()
            expect(observer).toHaveBeenCalledTimes(1)
        })
    })

    describe('value', () => {
        it('resolves to the manifest and path', async () => {
            const manifestController = createManifestController()
            const result = await manifestController.value
            expect(result).toEqual({
                manifest: mockDashManifest,
                baseUrl: 'https://example.com',
            })
        })
    })

    describe('getValue', () => {
        it('returns the same as value', () => {
            const manifestController = createManifestController()
            expect(manifestController.getValue()).toBe(manifestController.value)
        })
    })

    describe('changeId', () => {
        it('increments when manifest is refreshed', () => {
            const manifestController = createManifestController()
            const initial = manifestController.changeId
            manifestController.refresh()
            expect(manifestController.changeId).toBe(initial + 1)
        })
    })

    describe('pick', () => {
        it('returns a sub-observable', () => {
            const manifestController = createManifestController()
            const thenPick = manifestController.pick('then')
            expect(thenPick.value).toEqual(jasmine.any(Function))
        })
    })

    describe('disposed', () => {
        it('returns false before dispose', () => {
            const manifestController = createManifestController()
            expect(manifestController.disposed).toBe(false)
        })

        it('returns true after dispose', () => {
            const manifestController = createManifestController()
            manifestController.dispose()
            expect(manifestController.disposed).toBe(true)
        })
    })

    describe('value - pending', () => {
        it('resolves pending manifest', async () => {
            const deferredManifestAndPath = new Deferred<DashManifestData>()
            manifestProvider.and.returnValue(deferredManifestAndPath)

            const manifestController = createManifestController()
            const valuePromise = manifestController.value
            deferredManifestAndPath.resolve({
                manifest: mockDashManifest,
                baseUrl: 'https://example.com',
            })
            expect(await valuePromise).toEqual({
                manifest: mockDashManifest,
                baseUrl: 'https://example.com',
            })
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
        it('is null when manifest loads successfully', () => {
            const manifestController = createManifestController()
            expect(manifestController.error).toBeNull()
        })

        it('is set when manifest provider rejects', async () => {
            manifestProvider.and.rejectWith(new Error('test error'))
            const manifestController = createManifestController()
            await expectAsync(manifestController.value).toBeRejected()
            expect(manifestController.error).toEqual(
                jasmine.objectContaining({ message: 'test error' })
            )
        })

        it('is cleared after refresh', async () => {
            manifestProvider.and.rejectWith(new Error('test error'))
            const manifestController = createManifestController()
            await expectAsync(manifestController.value).toBeRejected()
            expect(manifestController.error).not.toBeNull()

            manifestProvider.and.resolveTo({
                manifest: mockDashManifest,
                baseUrl: 'https://example.com',
            })
            manifestController.refresh()
            expect(manifestController.error).toBeNull()
        })
    })

    describe('reset', () => {
        it('refreshes manifest when there was an error', async () => {
            manifestProvider.and.rejectWith(new Error('test error'))
            const manifestController = createManifestController()

            await expectAsync(manifestController.value).toBeRejected()

            manifestProvider.and.resolveTo({
                manifest: mockDashManifest,
                baseUrl: 'https://example.com',
            })
            manifestController.reset()
            expect(manifestProvider.calls.count()).toBe(2)
        })

        it('does nothing when no error occurred', () => {
            const manifestController = createManifestController()
            const initialCallCount = manifestProvider.calls.count()

            manifestController.reset()

            expect(manifestProvider.calls.count()).toBe(initialCallCount)
        })
    })

    describe('map', () => {
        it('transforms the manifest data', () => {
            const manifestController = createManifestController()
            const mapped = manifestController.map((promise) =>
                promise.then((data) => data.manifest)
            )
            expect(mapped).toBeDefined()
        })
    })

    describe('pick', () => {
        it('picks a property from the manifest data', () => {
            const manifestController = createManifestController()
            // Pick a property that exists on Promise<DashManifestData>
            const picked = manifestController.pick('then')
            expect(picked).toBeDefined()
        })
    })

    describe('dispose', () => {
        it('aborts current request', () => {
            const deferred = new Deferred<DashManifestData>()
            manifestProvider.and.returnValue(deferred)

            const manifestController = createManifestController()
            const abort = manifestProvider.calls.first().args[0] as Abort
            manifestController.dispose()
            expect(abort.aborted()).toBeTrue()
        })
    })
})
