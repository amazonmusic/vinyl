/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    defaultMediaElementPatchOptions,
    patchMediaElement,
    supportsMse,
} from '@amazon/vinyl'
import {
    DomEventHost,
    nextEventAsPromise,
    noop,
    type ReadonlyEventHost,
    withTimeout,
} from '@amazon/vinyl-util'
import { setTestTimeout } from '@amazon/vinyl-util/browserTestUtil'
import {
    ControlledMediaSource,
    mediaRef,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'

import { addPatchTests, createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('unreliablePlaybackEventsPatch integ', () => {
    setTestTimeout(25)

    async function canReproduce(media: HTMLMediaElement): Promise<boolean> {
        const domEvents = new DomEventHost<HTMLMediaElementEventMap>(media)
        const result =
            (await runWaitingScenarios(media, domEvents)) ||
            (await runPlayingScenarios(media, domEvents))

        domEvents.dispose()
        return result
    }

    async function runWaitingScenarios(
        media: HTMLMediaElement,
        domEvents: ReadonlyEventHost<HTMLMediaElementEventMap>
    ): Promise<boolean> {
        if (!supportsMse()) {
            // Cannot simulate waiting scenario
            return false
        }
        const waitingSpy = createEventSpy(domEvents, 'waiting')
        // Check for waiting event on playback start
        let nextWaiting = waitingSpy.next(7).catch(noop)
        const mediaSource = new ControlledMediaSource()
        const loadedMetadataSpy = createEventSpy(domEvents, 'loadedmetadata')
        const nextLoadedMetadata = loadedMetadataSpy.next(10)

        media.src = URL.createObjectURL(await mediaSource.getMediaSource())
        await mediaSource.appendNext() // init segment
        await nextLoadedMetadata
        void media.play()
        await nextWaiting
        if (!waitingSpy.calls.any()) {
            return true
        }

        // Check for waiting event when reaching end of buffer
        await mediaSource.appendNext() // 10s
        // Seek to near the end of the buffer to shorten test duration, but don't seek closer than
        // 3s from the end or playback might not resume which would conflate with the unbuffered
        // position check.
        media.currentTime = 7
        await nextEventAsPromise(domEvents, 'timeupdate', {
            filter: () => media.currentTime > 9.5,
        })
        waitingSpy.calls.reset()
        await waitingSpy.next(5).catch(noop)
        if (!waitingSpy.calls.any()) {
            return true
        }
        waitingSpy.calls.reset()

        // Check for waiting event when seeking to unbuffered region
        await mediaSource.appendNext() // 30s
        await nextEventAsPromise(domEvents, 'timeupdate')
        expect(waitingSpy).not.toHaveBeenCalled()
        nextWaiting = waitingSpy.next(5).catch(noop)
        media.currentTime = 40 // unbuffered region
        await nextWaiting

        media.removeAttribute('src')
        media.load()

        return !waitingSpy.calls.any()
    }

    /**
     * Resolves to true if after a seek when playing the 'playing' event is missing.
     */
    async function runPlayingScenarios(
        media: HTMLMediaElement,
        domEvents: ReadonlyEventHost<HTMLMediaElementEventMap>
    ): Promise<boolean> {
        media.src = vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps

        // Some browsers (iOS) do not support seeking before a play has happened in a secure
        // context. seekTo will cause the seek to be pending until the first play.
        await withTimeout(media.play(), 10, 'play timed out')

        media.currentTime = 15
        let canReproduce: boolean
        try {
            await nextEventAsPromise(domEvents, 'playing', { timeout: 10 })
            canReproduce = false
        } catch {
            // Missing playing event, the patch must be applied.
            canReproduce = true
        }
        media.removeAttribute('src')
        media.load()
        return canReproduce
    }

    addPatchTests(
        'unreliablePlaybackEvents',
        'ensures waiting events are emitted when playback reaches end of buffer',
        () => ({
            target: mediaRef.value,
            canReproduce,
            actualFlag:
                defaultMediaElementPatchOptions.value.unreliablePlaybackEvents,
            patchedRef: patchMediaElement(
                mediaRef.value,
                defaultMediaElementPatchOptions.value
            ),
            allowFalseNegative: true,
        })
    )
})
