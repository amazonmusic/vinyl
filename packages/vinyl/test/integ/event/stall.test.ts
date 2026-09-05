/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { supportsMse } from '@amazon/vinyl'
import {
    ControlledMediaSource,
    createVinylSuite,
    onPlaying,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('stall integ', () => {
    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    const suite = createVinylSuite()

    describe('when the play head freezes mid-playback', () => {
        it('emits stallEntered then stallEnded when playback resumes', async () => {
            const player = suite.player
            const stallEnteredSpy = createEventSpy(player, 'stallEntered')
            const stallEndedSpy = createEventSpy(player, 'stallEnded')

            const mediaSource = new ControlledMediaSource()
            player.load({
                type: 'src',
                uri: URL.createObjectURL(await mediaSource.getMediaSource()),
            })
            void player.play()
            await mediaSource.appendNext() // init segment
            await mediaSource.appendNext() // 10s of data

            // Playback has begun.
            await onPlaying(player)
            // Initial loading/buffering must not have counted as a stall.
            expect(stallEnteredSpy).not.toHaveBeenCalled()

            // Seek within the buffered range (0-10s), then let playback run to
            // the end of buffered data. With no further data appended, the play
            // head freezes there mid-playback — a stall. (5s is the furthest we
            // can safely seek; some platforms won't resume nearer the segment
            // end.)
            const nextEntered = stallEnteredSpy.next(
                30,
                'stallEntered after hitting end of buffer timed out after {timeout}s'
            )
            await player.seekTo(5)
            await nextEntered

            // Append the next segment; playback resumes and the stall ends.
            const nextEnded = stallEndedSpy.next(
                10,
                'stallEnded after data buffered timed out after {timeout}s'
            )
            await mediaSource.appendNext() // 20s of data
            const ended = await nextEnded

            expect(ended.reason).toBe('playing')
            expect(stallEnteredSpy).toHaveBeenCalledTimes(1)
            // The stall lasted at least the detection threshold.
            expect(ended.duration).toBeGreaterThan(0.5)
        })
    })
})
