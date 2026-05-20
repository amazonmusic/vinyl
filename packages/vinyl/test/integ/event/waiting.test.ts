/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { supportsMse } from '@amazon/vinyl'
import { nextEventAsPromise } from '@amazon/vinyl-util'
import {
    ControlledMediaSource,
    createVinylSuite,
} from '@amazon/vinyl/vinylTestUtil'

import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('waiting integ', () => {
    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    const suite = createVinylSuite()

    describe('when playback is stopped due to lack of data', () => {
        it('emits waiting event', async () => {
            const player = suite.player
            const waitingSpy = createEventSpy(player, 'waiting')
            const waitedSpy = createEventSpy(player, 'waited')
            const playSpy = createEventSpy(player, 'play')
            const mediaSource = new ControlledMediaSource()
            player.load({
                type: 'src',
                uri: URL.createObjectURL(await mediaSource.getMediaSource()),
            })
            const nextPlay = playSpy.next(5)
            void player.play()
            let nextWaiting = waitingSpy.next(
                10,
                'waiting after play when not buffered'
            )
            await mediaSource.appendNext() // init segment
            await nextPlay
            // Once metadata is loaded, the playback controller will now call play() on the element.
            // the 'waiting' event will now be dispatched due to waiting for the first data segment.
            await nextWaiting
            expect(player.waiting).toBeTrue()
            let nextWaited = waitedSpy.next(
                5,
                'waited 1 timeout after {timeout}s'
            )

            // Append the first data segment; now playback can begin. Expect a 'waited' event
            // followed by a 'playing' event and the play promise resolving.
            await mediaSource.appendNext() // 10s
            await nextWaited
            expect(player.waiting).withContext('waiting').toBeFalse()

            // Must be at least 5s before the end of the segment or playback will not resume on some platforms
            // Typically this issue is handled by Vinyl's playback controller, however in the case of a
            // controlled media source, the segment won't be buffered until requested, so 5s is the furthest
            // we can safely seek.
            await player.seekTo(5)

            await waitingSpy.next(
                30,
                'waiting after hit end of buffer timed out after {timeout}s'
            )
            nextWaited = waitedSpy.next(
                5,
                'waited after data buffered timed out after {timeout}s'
            )
            await mediaSource.appendNext() // 20s
            await nextWaited

            nextWaiting = nextEventAsPromise(player, 'waiting', {
                timeout: 5,
                timeoutMessage:
                    'waiting after seek to unbuffered region timed out after {time}s',
            })
            const seekPromise = player.seekTo(22) // unbuffered region
            await nextWaiting
            nextWaited = waitedSpy.next(
                5,
                'waited after data buffered 2 timed out after {timeout}s'
            )
            await mediaSource.appendNext() // 30s
            await nextWaited
            await seekPromise
        })
    })
})
