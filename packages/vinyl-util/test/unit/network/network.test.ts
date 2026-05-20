/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    getNetworkState,
    isNode,
    networkState,
    NetworkStateImpl,
    onLine,
} from '@amazon/vinyl-util'
import {
    implementEventFakes,
    mockEvent,
    MockEventTarget,
    type MockNavigator,
} from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import Spy = jasmine.Spy
import {
    MockNetworkState,
    overrideGlobalInit,
    setMockNavigator,
} from '@amazon/vinyl-util/testUtil'

describe('NetworkState', () => {
    let navigator: MockNavigator
    let eventTarget: MockEventTarget
    let networkStateImpl: NetworkStateImpl

    beforeEach(() => {
        eventTarget = new MockEventTarget()
        implementEventFakes(eventTarget)
        navigator = setMockNavigator()
        networkStateImpl = new NetworkStateImpl({ navigator, eventTarget })
    })

    describe('onLine', () => {
        it('returns true if navigator.onLine is true', () => {
            navigator.onLine = true
            expect(networkStateImpl.onLine).toBeTrue()
            navigator.onLine = false
            expect(networkStateImpl.onLine).toBeFalse()
        })
    })

    describe('nextOnLine', () => {
        it('rejects immediately if the abortSignal is aborted', async () => {
            const abort = new Abort()
            const reason = new Error('reason')
            abort.abort(reason)
            await expectAsync(
                networkStateImpl.nextOnLine(abort)
            ).toBeRejectedWith(reason)
        })

        it('rejects immediately if the abortSignal is aborted if navigator.onLine is true', async () => {
            navigator.onLine = true
            const abort = new Abort()
            abort.abort()
            await expectAsync(networkStateImpl.nextOnLine(abort)).toBeRejected()
        })

        it('resolves immediately if navigator.onLine is true', async () => {
            navigator.onLine = true
            await expectAsync(networkStateImpl.nextOnLine()).toBeResolved()
        })

        it('resolves on the next window online event if onLine is false', async () => {
            navigator.onLine = false
            await expectAsync(networkStateImpl.nextOnLine()).toBePending()
            setTimeout(() => {
                navigator.onLine = true
                eventTarget.dispatchEvent(mockEvent('online'))
            })
            await expectAsync(networkStateImpl.nextOnLine()).toBeResolved()
        })
    })

    describe('NetworkStateImpl.createDefaultDeps', () => {
        describe('when window is not defined', () => {
            beforeEach(() => {
                if (!isNode()) pending('Requires node environment')
            })

            it('creates a fake event target', () => {
                const defaultDeps = NetworkStateImpl.createDefaultDeps()
                expect(defaultDeps).toEqual({
                    eventTarget: objectContaining({
                        addEventListener: any(Function),
                        removeEventListener: any(Function),
                        dispatchEvent: any(Function),
                    }),
                    navigator: {
                        onLine: true,
                    },
                })
                defaultDeps.eventTarget.addEventListener('online', () => {})
                defaultDeps.eventTarget.removeEventListener('online', () => {})
                expect(
                    defaultDeps.eventTarget.dispatchEvent(mockEvent(''))
                ).toBeTrue()
            })
        })

        describe('when window is defined', () => {
            let mockWindow: {
                navigator: {
                    onLine: boolean
                }
                addEventListener: Spy
                removeEventListener: Spy
            }

            beforeEach(() => {
                if (!isNode()) pending('NODE environment test')
                mockWindow = {
                    addEventListener: createSpy('addEventListener'),
                    removeEventListener: createSpy('addEventListener'),
                    navigator: {
                        onLine: true,
                    },
                }
                ;(global as any).window = mockWindow
            })

            afterEach(() => {
                if (isNode()) delete (global as any).window
            })

            it('uses window as eventTarget and window.navigator', () => {
                expect(NetworkStateImpl.createDefaultDeps()).toEqual({
                    eventTarget: window,
                    navigator: window.navigator,
                })
            })
        })

        describe('when default constructor is used', () => {
            it('uses dependencies from NetworkStateImpl.createDefaultDeps', () => {
                const createDefaultDepsSpy = spyOn(
                    NetworkStateImpl,
                    'createDefaultDeps'
                ).and.callThrough()
                new NetworkStateImpl()
                expect(createDefaultDepsSpy).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('getNetworkState', () => {
        it('returns the networkState value', () => {
            expect(getNetworkState()).toEqual(networkState.value)
        })
    })

    describe('onLine', () => {
        const mockNetworkStateRef = overrideGlobalInit(
            networkState,
            () => new MockNetworkState()
        )

        it('returns the networkState onLine value', () => {
            mockNetworkStateRef.value.onLine = false
            expect(onLine()).toEqual(false)
            mockNetworkStateRef.value.onLine = true
            expect(onLine()).toEqual(true)
        })
    })
})
