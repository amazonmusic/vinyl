/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AutoResetControllerImpl,
    type AutoResetControllerImplDeps,
    type AutoResetControllerImplOptions,
} from '@amazon/vinyl'
import {
    ErrorOrigin,
    ReportableError,
    networkState,
    DisposedError,
} from '@amazon/vinyl-util'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import {
    createEventSpy,
    MockNetworkState,
    overrideGlobalInit,
} from '@amazon/vinyl-util/testUtil'
import { mockEvent, useMockTime } from '@amazon/vinyl-util/browserTestUtil'

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
    })

    describe('setError', () => {
        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
        })

        it('ignores non-ReportableError', () => {
            const error = new Error('test error')
            controller.setError(error)
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })

        it('ignores ReportableError with non-SERVICE_INTERNAL origin', () => {
            const error = new ReportableError(
                'test',
                ErrorOrigin.SERVICE_EXTERNAL
            )
            controller.setError(error)
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })

        it('sets error and starts watching for SERVICE_INTERNAL ReportableError', () => {
            const error = new ReportableError(
                'test',
                ErrorOrigin.SERVICE_INTERNAL
            )
            controller.setError(error)
            expect(mockNetworkState.on).toHaveBeenCalledWith(
                'online',
                jasmine.any(Function)
            )
        })

        it('ignores subsequent errors when already in error state', () => {
            const error1 = new ReportableError(
                'test1',
                ErrorOrigin.SERVICE_INTERNAL
            )
            const error2 = new ReportableError(
                'test2',
                ErrorOrigin.SERVICE_INTERNAL
            )

            controller.setError(error1)
            mockNetworkState.on.calls.reset()

            controller.setError(error2)
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })
    })

    describe('reset behavior', () => {
        let resetSpy: jasmine.Spy
        let error: ReportableError

        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
            resetSpy = createEventSpy(controller, 'reset')
            error = new ReportableError('test', ErrorOrigin.SERVICE_INTERNAL)
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
        let error: ReportableError

        beforeEach(() => {
            error = new ReportableError('test', ErrorOrigin.SERVICE_INTERNAL)
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
    })

    describe('clear', () => {
        let error: ReportableError

        beforeEach(() => {
            controller = new AutoResetControllerImpl(deps)
            error = new ReportableError('test', ErrorOrigin.SERVICE_INTERNAL)
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
            const error = new ReportableError(
                'test',
                ErrorOrigin.SERVICE_INTERNAL
            )
            controller.setError(error)

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
            const error = new ReportableError(
                'test',
                ErrorOrigin.SERVICE_INTERNAL
            )

            controller.setError(error)
            expect(mockNetworkState.on).not.toHaveBeenCalled()
        })

        it('does not emit reset events when disabled', () => {
            controller = new AutoResetControllerImpl(deps, { enabled: false })
            const resetSpy = createEventSpy(controller, 'reset')
            const error = new ReportableError(
                'test',
                ErrorOrigin.SERVICE_INTERNAL
            )

            controller.setError(error)
            playbackController.dispatch('play', {})

            expect(resetSpy).not.toHaveBeenCalled()
        })
    })
})
