/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { playbackStateLoggingHandler, TIMEUPDATE_THROTTLE } from '@amazon/vinyl'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'
import type { Disposable } from '@amazon/vinyl-util'
import any = jasmine.any

describe('playbackStateLoggingHandler', () => {
    let playback: MockPlaybackController
    const clock = useMockTime()

    async function playbackTick(timeDelta: number) {
        playback.currentTime += timeDelta
        await clock.tick(timeDelta)
        playback.dispatch('timeUpdate', {} as any)
    }

    const loggerRef = useMockLogger()
    beforeEach(() => {
        playback = new MockPlaybackController()
    })

    describe('when initialized', () => {
        let loggingHandler: Disposable

        beforeEach(() => {
            loggingHandler = playbackStateLoggingHandler(playback)
        })

        afterEach(() => {
            loggingHandler.dispose()
        })

        it('records all playback events', () => {
            const logger = loggerRef.value
            playback.dispatch('play', {})
            expect(logger.debug).toHaveBeenCalledWith(
                any(Object),
                'play',
                any(Object)
            )
            logger.debug.calls.reset()
            playback.dispatch('loadedMetadata', {})
            expect(logger.debug).toHaveBeenCalledWith(
                any(Object),
                'loadedMetadata',
                any(Object)
            )
            logger.debug.calls.reset()
            playback.dispatch('abort', {})
            expect(logger.debug).toHaveBeenCalledWith(
                any(Object),
                'abort',
                any(Object)
            )
        })

        describe('when timeUpdate events are emitted', () => {
            describe('and are uninterrupted and incremental', () => {
                it('accumulates timeUpdate events up to a defined TIMEUPDATE_THROTTLE limit', async () => {
                    const logger = loggerRef.value
                    logger.debug.calls.reset()
                    await playbackTick(0)
                    for (let i = 0; i < 4; i++) {
                        await playbackTick(TIMEUPDATE_THROTTLE / 5)
                    }
                    expect(logger.debug).not.toHaveBeenCalled()
                    await playbackTick(TIMEUPDATE_THROTTLE / 5)
                    expect(logger.debug).toHaveBeenCalledWith(
                        any(Object),
                        `timeUpdate 0.0-${TIMEUPDATE_THROTTLE.toFixed(1)} x5`
                    )
                    logger.debug.calls.reset()
                })
            })

            describe('and are interrupted by another event', () => {
                it('logs the batch preceding the current timeUpdate', async () => {
                    const logger = loggerRef.value
                    await playbackTick(2.234)
                    await playbackTick(2.344)
                    await playbackTick(1.95)
                    playback.dispatch('seeked', {} as any)
                    expect(logger.debug).toHaveBeenCalledWith(
                        any(Object),
                        'seeked',
                        any(Object)
                    )
                    expect(logger.debug).toHaveBeenCalledWith(
                        any(Object),
                        'timeUpdate 2.2-6.5 x3'
                    )
                })
            })
        })
    })

    describe('when disposed', () => {
        it('detaches from events when no longer needed', async () => {
            const loggingHandler = playbackStateLoggingHandler(playback)
            const logger = loggerRef.value
            logger.debug.calls.reset()
            loggingHandler.dispose()
            await playbackTick(2.234) // startTime: 2.234
            await playbackTick(2.344)
            await playbackTick(1.95)
            await clock.tick(100)
            playback.dispatch('seeked', {} as any)
            expect(logger.debug).not.toHaveBeenCalled()
        })
    })
})
