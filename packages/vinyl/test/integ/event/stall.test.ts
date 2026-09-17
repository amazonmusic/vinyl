/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { supportsMse } from '@amazon/vinyl'
import {
    ControlledMediaSource,
    createVinylSuite,
    onPlaying,
    onTimeUpdate,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('stall integ', () => {
    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    const suite = createVinylSuite()

    /**
     * Loads 10s of data, starts playback, then seeks toward the end of the buffer so the play head
     * runs into the end of buffered data and freezes mid-playback — a stall. Resolves once the
     * `stallEntered` event has fired, with the spies and media source for driving the resolution.
     *
     * (5s is the furthest we can safely seek within a 10s segment; some platforms won't resume
     * nearer the segment end.)
     */
    async function arrangeStall() {
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

        const entered = stallEnteredSpy.next(
            30,
            'stallEntered after hitting end of buffer timed out after {timeout}s'
        )
        await player.seekTo(5)
        await entered

        return { player, mediaSource, stallEnteredSpy, stallEndedSpy }
    }

    describe('when the play head freezes mid-playback', () => {
        it('emits stallEntered then stallEnded when playback resumes', async () => {
            const { player, mediaSource, stallEnteredSpy, stallEndedSpy } =
                await arrangeStall()

            // Append the next segment; playback resumes and the stall ends.
            const nextEnded = stallEndedSpy.next(
                10,
                'stallEnded after data buffered timed out after {timeout}s'
            )
            await mediaSource.appendNext() // 20s of data
            const ended = await nextEnded

            expect(ended.reason).toBe('playing')
            // The single freeze must produce exactly one stallEntered/stallEnded pair.
            expect(stallEnteredSpy).toHaveBeenCalledTimes(1)
            expect(stallEndedSpy).toHaveBeenCalledTimes(1)
            // The stall lasted at least the detection threshold.
            expect(ended.duration).toBeGreaterThan(0.5)

            // Let playback actually progress well past the resume (several timeUpdates over ~1s of
            // real play), giving any spurious re-detection or duplicate delivery time to surface.
            for (let i = 0; i < 5; i++) await onTimeUpdate(player)
            expect(stallEnteredSpy).toHaveBeenCalledTimes(1)
            expect(stallEndedSpy).toHaveBeenCalledTimes(1)
        })

        it('ends the stall with reason "seeking" when the user seeks away mid-stall', async () => {
            const { player, stallEnteredSpy, stallEndedSpy } =
                await arrangeStall()

            // Seek back into the buffered range while stalled: the stall ends, attributed to the
            // seek, not to a resume.
            const nextEnded = stallEndedSpy.next(
                10,
                'stallEnded after seeking away timed out after {timeout}s'
            )
            await player.seekTo(1)
            const ended = await nextEnded

            expect(ended.reason).toBe('seeking')
            expect(stallEnteredSpy).toHaveBeenCalledTimes(1)
            expect(stallEndedSpy).toHaveBeenCalledTimes(1)
        })

        it('ends the stall with reason "emptied" when the track is unloaded mid-stall', async () => {
            const { player, stallEnteredSpy, stallEndedSpy } =
                await arrangeStall()

            // Unloading the track empties the media element: the stall ends, attributed to the
            // empty, and no further stall events fire once there is no source.
            const nextEnded = stallEndedSpy.next(
                10,
                'stallEnded after unload timed out after {timeout}s'
            )
            player.unload()
            const ended = await nextEnded

            expect(ended.reason).toBe('emptied')
            expect(stallEnteredSpy).toHaveBeenCalledTimes(1)
            expect(stallEndedSpy).toHaveBeenCalledTimes(1)
        })

        it('reports each distinct freeze exactly once', async () => {
            const { player, mediaSource, stallEnteredSpy, stallEndedSpy } =
                await arrangeStall()

            // arrangeStall already produced freeze #1 (seek to 5, frozen at 10). Resume it, then
            // drive a second, distinct freeze. Each freeze must produce exactly one
            // stallEntered/stallEnded pair — resumes must never be miscounted as stalls, and a
            // resume must not spuriously re-trigger the just-cleared stall.
            const firstEnded = stallEndedSpy.next(
                10,
                'stallEnded for freeze 1 timed out after {timeout}s'
            )
            await mediaSource.appendNext() // buffer 10-20s; playback resumes
            expect((await firstEnded).reason).toBe('playing')
            expect(stallEnteredSpy).toHaveBeenCalledTimes(1)
            expect(stallEndedSpy).toHaveBeenCalledTimes(1)

            // Freeze #2: seek toward the new end of buffer (15s within 0-20s) and run into it.
            const secondEntered = stallEnteredSpy.next(
                30,
                'stallEntered for freeze 2 timed out after {timeout}s'
            )
            await player.seekTo(15)
            await secondEntered
            expect(stallEnteredSpy).toHaveBeenCalledTimes(2)

            const secondEnded = stallEndedSpy.next(
                10,
                'stallEnded for freeze 2 timed out after {timeout}s'
            )
            await mediaSource.appendNext() // buffer 20-30s; playback resumes
            expect((await secondEnded).reason).toBe('playing')

            // Settle: no late duplicates from either cycle.
            for (let i = 0; i < 5; i++) await onTimeUpdate(player)
            expect(stallEnteredSpy).toHaveBeenCalledTimes(2)
            expect(stallEndedSpy).toHaveBeenCalledTimes(2)
        })
    })
})
