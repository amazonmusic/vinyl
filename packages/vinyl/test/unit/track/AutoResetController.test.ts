/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AutoResetControllerImpl,
    type AutoResetControllerImplDeps,
    type AutoResetControllerImplOptions,
} from '@amazon/vinyl'
import { networkState, DisposedError, RequestError } from '@amazon/vinyl-util'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import {
    createEventSpy,
    emptyInternalError,
    emptyResponseError,
    MockNetworkState,
    overrideGlobalInit,
} from '@amazon/vinyl-util/testUtil'
import { mockEvent, useMockTime } from '@amazon/vinyl-util/browserTestUtil'

/**
 * Creates a RequestError representing a transient network failure (no response received).
 * These are the only errors that AutoResetController watches for retry opportunities.
 */
function createNetworkRequestError(): RequestError {
    return new RequestError(null, emptyInternalError)
}

/**
 * Creates a RequestError that received an HTTP response. These should be ignored by
 * the AutoResetController, since a service that responded is unlikely to recover
 * on its own.
 */
function createResponseRequestError(): RequestError {
    return new RequestError(
        new Response(null, { status: 500 }),
        emptyResponseError
    )
}

describe('AutoResetControllerImpl', () => {
    let deps: AutoResetControllerImplDeps
    let controller: AutoResetControllerImpl
    let playbackController: MockPlaybackController

    const mockNetworkStateRef = overrideGlobalInit(
        networkState,
        () => new MockNetworkState()
    )
    let mockNetworkState: MockNetworkState

    const clock = useMockTime()

    beforeEach(() => {
        playbackController = new MockPlaybackController()
        deps = {
            playbackController: playbackController,
        }

        mockNetworkState = mockNetworkStateRef.value
        mockNetworkState.onLine = true
    })

    afterEach(() => {
        if (!controller.disposed) controller.dispose()
    })

    describe('constructor', () => {
        it('creates instance with default options', () => {
            controller = new AutoResetControllerImpl(deps)
            expect(controller).toBeDefined()
            expect(controller[Symbol.toStringTag]).toBe(
                'AutoResetControllerImpl'
            )
        })

        it('merges provided options with defaults', () => {
            const options: Partial<AutoResetControllerImplOptions> = {
                enabled: false,
                maxRetries: 10,
            }
            controller = new AutoResetControllerImpl(deps, options)
            expect(controller).toBeDefined()
        })

        it('subscribes to playback controller events', () => {
            controller = new AutoResetControllerImpl(deps)
            expect(playbackController.on).toHaveBeenCalledWith(
                'play',
                jasmine.any(Function)
            )
            expect(playbackController.on).toHaveBeenCalledWith(
                'pause',
                jasmine.any(Function)
            )
            expect(playbackController.on).toHaveBeenCalledWith(
                'seeking',
                jasmine.any(Function)
            )
            expect(playbackController.on).toHaveBeenCalledWith(
                'playing',
                jasmine.any(Function)
            )
        })

        it('starts with resetPending false', () => {
            controller = new AutoResetControllerImpl(deps)
            expect(controller.resetPending).toBeFalse()
        })
    })

    describe('setError', () => {
        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
        })

        it('ignores non-RequestError', () => {
            const error = new Error('test error')
            controller.setError(error)
            expect(mockNetworkState.on).not.toHaveBeenCalled()
            expect(controller.resetPending).toBeFalse()
        })

        it('ignores RequestError with a response (HTTP failure)', () => {
            controller.setError(createResponseRequestError())
            expect(mockNetworkState.on).not.toHaveBeenCalled()
            expect(controller.resetPending).toBeFalse()
        })

        it('sets error and starts watching for transient network RequestError', () => {
            controller.setError(createNetworkRequestError())
            expect(mockNetworkState.on).toHaveBeenCalledWith(
                'online',
                jasmine.any(Function)
            )
            expect(controller.resetPending).toBeTrue()
        })

        it('ignores subsequent errors when already in error state', () => {
            controller.setError(createNetworkRequestError())
            mockNetworkState.on.calls.reset()

            controller.setError(createNetworkRequestError())
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })
    })

    describe('reset behavior', () => {
        let resetSpy: jasmine.Spy
        let error: RequestError

        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
            resetSpy = createEventSpy(controller, 'reset')
            error = createNetworkRequestError()
        })

        it('emits reset event when network comes online', () => {
            controller.setError(error)

            const onlineCallback = mockNetworkState.on.calls.argsFor(0)[1]
            onlineCallback(mockEvent('online'))

            expect(resetSpy).toHaveBeenCalledWith({})
        })

        it('does not emit reset when no error is set', () => {
            // Trigger online event without setting error first
            mockNetworkState.dispatch('online', mockEvent('online'))
            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('emits reset on playback controller events when in error state', () => {
            controller.setError(error)
            playbackController.dispatch('play', {})
            expect(resetSpy).toHaveBeenCalledWith({})

            resetSpy.calls.reset()
            controller.setError(error)
            playbackController.dispatch('pause', {})
            expect(resetSpy).toHaveBeenCalledWith({})

            resetSpy.calls.reset()
            controller.setError(error)
            playbackController.dispatch('seeking', {})
            expect(resetSpy).toHaveBeenCalledWith({})

            resetSpy.calls.reset()
            controller.setError(error)
            playbackController.dispatch('playing', {})
            expect(resetSpy).toHaveBeenCalledWith({})
        })

        it('does not emit reset on playback events when no error is set', () => {
            playbackController.dispatch('play', {})
            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('resets on playback events play, pause, seeking, playing', async () => {
            controller = new AutoResetControllerImpl(deps, {
                retryInterval: 1,
                maxRetries: 3,
            })
            resetSpy = createEventSpy(controller, 'reset')
            controller.setError(error)

            // Expect 'play' to trigger a reset immediately
            playbackController.dispatch('play', {})
            expect(resetSpy).toHaveBeenCalledTimes(1)

            // Exhaust retries
            for (let i = 0; i < 3; i++) {
                controller.setError(error)
                await clock.tick(1)
            }

            resetSpy.calls.reset()
            for (let i = 0; i < 3; i++) {
                // Should not be resetting after max retries has been exhausted
                controller.setError(error)
                await clock.tick(1)
                expect(resetSpy).toHaveBeenCalledTimes(0)
            }

            // Expect 'pause' to trigger a reset immediately, even if retries are exhausted
            playbackController.dispatch('pause', {})
            expect(resetSpy).toHaveBeenCalledTimes(1)
            resetSpy.calls.reset()

            // Expect retry count to have been reset
            for (let i = 1; i <= 3; i++) {
                controller.setError(error)
                await clock.tick(1)
                expect(resetSpy).toHaveBeenCalledTimes(i)
            }

            // Expect max retries to be respected after reset
            for (let i = 1; i <= 3; i++) {
                controller.setError(error)
                await clock.tick(1)
                expect(resetSpy).toHaveBeenCalledTimes(3)
            }
        })
    })

    describe('retry interval behavior', () => {
        let resetSpy: jasmine.Spy
        let error: RequestError

        beforeEach(() => {
            error = createNetworkRequestError()
        })

        it('retries at specified interval when online', async () => {
            controller = new AutoResetControllerImpl(deps, { retryInterval: 5 })
            resetSpy = createEventSpy(controller, 'reset')

            controller.setError(error)

            await clock.tick(4.999)
            expect(resetSpy).toHaveBeenCalledTimes(0)

            await clock.tick(0.001)
            expect(resetSpy).toHaveBeenCalledTimes(1)
        })

        it('does not retry when offline', async () => {
            mockNetworkState.onLine = false
            controller = new AutoResetControllerImpl(deps, { retryInterval: 1 })
            resetSpy = createEventSpy(controller, 'reset')

            controller.setError(error)

            await clock.tick(1)
            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('continues retrying up to maxRetries', async () => {
            controller = new AutoResetControllerImpl(deps, {
                retryInterval: 1,
                maxRetries: 3,
            })
            resetSpy = createEventSpy(controller, 'reset')

            for (let i = 1; i <= 3; i++) {
                controller.setError(error)
                await clock.tick(1)
                expect(resetSpy).toHaveBeenCalledTimes(i)
            }

            // Should stop after maxRetries
            for (let i = 1; i <= 3; i++) {
                controller.setError(error)
                await clock.tick(1)
                expect(resetSpy).toHaveBeenCalledTimes(3)
            }
        })

        it('clears resetPending when max retries are exhausted', async () => {
            controller = new AutoResetControllerImpl(deps, {
                retryInterval: 1,
                maxRetries: 1,
            })

            controller.setError(error)
            expect(controller.resetPending).toBeTrue()

            // First retry succeeds (resets) and re-arms on next setError
            await clock.tick(1)
            controller.setError(error)
            expect(controller.resetPending).toBeTrue()

            // Second retry exhausts the budget — interval fires but no reset emitted,
            // and resetPending should transition to false.
            await clock.tick(1)
            expect(controller.resetPending).toBeFalse()
        })
    })

    describe('resetPending', () => {
        let error: RequestError

        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
            error = createNetworkRequestError()
        })

        it('is false initially', () => {
            expect(controller.resetPending).toBeFalse()
        })

        it('becomes true when an eligible error is set', () => {
            controller.setError(error)
            expect(controller.resetPending).toBeTrue()
        })

        it('remains false when a non-eligible error is set', () => {
            controller.setError(new Error('not eligible'))
            expect(controller.resetPending).toBeFalse()
        })

        it('becomes false after a reset is emitted', () => {
            controller.setError(error)
            playbackController.dispatch('play', {})
            expect(controller.resetPending).toBeFalse()
        })

        it('becomes false when cleared', () => {
            controller.setError(error)
            controller.clear()
            expect(controller.resetPending).toBeFalse()
        })

        it('is false when the controller is disabled', () => {
            controller = new AutoResetControllerImpl(deps, { enabled: false })
            controller.setError(error)
            expect(controller.resetPending).toBeFalse()
        })
    })

    describe('resetPendingChange event', () => {
        let resetPendingChangeSpy: jasmine.Spy
        let error: RequestError

        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
            resetPendingChangeSpy = createEventSpy(
                controller,
                'resetPendingChange'
            )
            error = createNetworkRequestError()
        })

        it('dispatches when resetPending becomes true', () => {
            controller.setError(error)
            expect(resetPendingChangeSpy).toHaveBeenCalledOnceWith({
                previous: false,
                current: true,
            })
        })

        it('dispatches when resetPending becomes false via reset', () => {
            controller.setError(error)
            resetPendingChangeSpy.calls.reset()

            playbackController.dispatch('play', {})
            expect(resetPendingChangeSpy).toHaveBeenCalledOnceWith({
                previous: true,
                current: false,
            })
        })

        it('dispatches when resetPending becomes false via clear', () => {
            controller.setError(error)
            resetPendingChangeSpy.calls.reset()

            controller.clear()
            expect(resetPendingChangeSpy).toHaveBeenCalledOnceWith({
                previous: true,
                current: false,
            })
        })

        it('does not dispatch when setError is called with an in-progress error', () => {
            controller.setError(error)
            resetPendingChangeSpy.calls.reset()

            controller.setError(error)
            expect(resetPendingChangeSpy).not.toHaveBeenCalled()
        })

        it('does not dispatch when clear is called with no error', () => {
            controller.clear()
            expect(resetPendingChangeSpy).not.toHaveBeenCalled()
        })

        it('does not dispatch when an ineligible error is set', () => {
            controller.setError(new Error('not eligible'))
            expect(resetPendingChangeSpy).not.toHaveBeenCalled()
        })
    })

    describe('clear', () => {
        let error: RequestError

        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
            error = createNetworkRequestError()
        })

        it('clears error state and stops watching', () => {
            controller.setError(error)
            expect(mockNetworkState.on).toHaveBeenCalled()

            controller.clear()

            // Should not emit reset after clearing
            const resetSpy = createEventSpy(controller, 'reset')
            playbackController.dispatch('play', {})
            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('does nothing when no error is set', () => {
            controller.clear()
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })

        it('stops timeout when clearing', async () => {
            controller = new AutoResetControllerImpl(deps, { retryInterval: 1 })
            const resetSpy = createEventSpy(controller, 'reset')

            controller.setError(error)
            controller.clear()

            await clock.tick(1)
            expect(resetSpy).not.toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('clears error state and disposes resources', () => {
            controller = new AutoResetControllerImpl(deps)
            controller.setError(createNetworkRequestError())

            controller.dispose()

            // Should not emit reset after disposing
            const resetSpy = createEventSpy(controller, 'reset')
            playbackController.dispatch('play', {})
            expect(resetSpy).not.toHaveBeenCalled()

            expect(playbackController.hasAnyListeners()).toBeFalse()
            expect(mockNetworkState.hasAnyListeners()).toBeFalse()
        })

        it('throws if already disposed', () => {
            controller = new AutoResetControllerImpl(deps)

            controller.dispose()

            expect(() => {
                controller.dispose()
            }).toThrowError(DisposedError)
        })
    })

    describe('disabled behavior', () => {
        it('does not watch for errors when disabled', () => {
            controller = new AutoResetControllerImpl(deps, { enabled: false })

            controller.setError(createNetworkRequestError())
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })

        it('does not emit reset events when disabled', () => {
            controller = new AutoResetControllerImpl(deps, { enabled: false })
            const resetSpy = createEventSpy(controller, 'reset')

            controller.setError(createNetworkRequestError())
            playbackController.dispatch('play', {})

            expect(resetSpy).not.toHaveBeenCalled()
        })
    })
})
