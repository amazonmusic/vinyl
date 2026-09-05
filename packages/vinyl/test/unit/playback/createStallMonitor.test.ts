/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createStallMonitor,
    type PlaybackControllerEventMap,
    type ReadonlyPlaybackController,
    StallEndedReason,
    type StallEndedInfo,
    type StallMonitorOptions,
} from '@amazon/vinyl'
import { EventHostImpl } from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import Spy = jasmine.Spy

describe('createStallMonitor', () => {
    const clock = useMockTime()
    let host: EventHostImpl<PlaybackControllerEventMap>
    let onStallEntered: Spy<() => void>
    let onStallEnded: Spy<(info: StallEndedInfo) => void>
    let stop: (() => void) | undefined

    beforeEach(() => {
        host = new EventHostImpl<PlaybackControllerEventMap>()
        onStallEntered = jasmine.createSpy('onStallEntered')
        onStallEnded = jasmine.createSpy('onStallEnded')
    })

    afterEach(() => stop?.())

    function monitor(overrides: StallMonitorOptions = {}) {
        stop = createStallMonitor(
            host as unknown as ReadonlyPlaybackController,
            { onStallEntered, onStallEnded },
            overrides
        )
    }

    /** Advances the mock clock by `n` default (0.25s) poll intervals. */
    async function poll(n: number) {
        for (let i = 0; i < n; i++) await clock.tick(0.25)
    }

    it('does not report a stall before playback is observed', async () => {
        monitor()
        // No 'playing' has been observed (e.g. initial load / awaiting a seek).
        await poll(8)
        expect(onStallEntered).not.toHaveBeenCalled()
    })

    it('reports a stall once the play head is frozen past the threshold', async () => {
        monitor()
        host.dispatch('playing', {})
        await poll(3) // 0.75s < 1s threshold
        expect(onStallEntered).not.toHaveBeenCalled()
        await poll(1) // 1s
        expect(onStallEntered).toHaveBeenCalledTimes(1)
    })

    it('honors a configurable threshold', async () => {
        monitor({ stallThreshold: 2 })
        host.dispatch('playing', {})
        await poll(4) // 1s < 2s
        expect(onStallEntered).not.toHaveBeenCalled()
        await poll(4) // 2s
        expect(onStallEntered).toHaveBeenCalledTimes(1)
    })

    it('does not report a stall while timeUpdates keep arriving', async () => {
        monitor()
        host.dispatch('playing', {})
        for (let i = 0; i < 10; i++) {
            await poll(2) // 0.5s, under the threshold
            host.dispatch('timeUpdate', { previous: i, current: i + 1 })
        }
        expect(onStallEntered).not.toHaveBeenCalled()
    })

    it('ends a stall with reason "playing" when the play head advances, measuring from the last timeUpdate', async () => {
        monitor()
        host.dispatch('playing', {})
        host.dispatch('timeUpdate', { previous: 0, current: 1 })
        await poll(4) // freeze 1s -> stallEntered
        expect(onStallEntered).toHaveBeenCalledTimes(1)
        await poll(4) // frozen another 1s (total 2s)
        host.dispatch('timeUpdate', { previous: 1, current: 2 }) // resume
        expect(onStallEnded).toHaveBeenCalledTimes(1)
        const info = onStallEnded.calls.mostRecent().args[0]
        expect(info.reason).toBe(StallEndedReason.PLAYING)
        expect(info.duration).toBeCloseTo(2, 1)
    })

    for (const [event, reason] of [
        ['pause', StallEndedReason.PAUSE],
        ['seeking', StallEndedReason.SEEKING],
        ['emptied', StallEndedReason.EMPTIED],
    ] as const) {
        it(`ends a stall with reason "${reason}" on ${event}`, async () => {
            monitor()
            host.dispatch('playing', {})
            await poll(4) // stallEntered
            expect(onStallEntered).toHaveBeenCalledTimes(1)
            host.dispatch(event, {})
            expect(onStallEnded).toHaveBeenCalledTimes(1)
            expect(onStallEnded.calls.mostRecent().args[0].reason).toBe(reason)
        })
    }

    it('ends a stall with reason "playing" when a playing event fires (resume without a timeUpdate)', async () => {
        monitor()
        host.dispatch('playing', {})
        await poll(4) // stallEntered
        expect(onStallEntered).toHaveBeenCalledTimes(1)
        // A 'playing' event (rather than a timeUpdate) signals the resume.
        host.dispatch('playing', {})
        expect(onStallEnded).toHaveBeenCalledTimes(1)
        expect(onStallEnded.calls.mostRecent().args[0].reason).toBe(
            StallEndedReason.PLAYING
        )
    })

    it('suspends detection after a seek until playback is observed again', async () => {
        monitor()
        host.dispatch('playing', {})
        host.dispatch('seeking', {}) // suspends; observedPlaying = false
        await poll(8)
        expect(onStallEntered).not.toHaveBeenCalled()
        // Once playback is observed again, detection resumes.
        host.dispatch('playing', {})
        await poll(4)
        expect(onStallEntered).toHaveBeenCalledTimes(1)
    })

    it('reports each stall/recovery cycle', async () => {
        monitor()
        host.dispatch('playing', {})
        await poll(4)
        host.dispatch('timeUpdate', { previous: 0, current: 1 }) // resume 1
        await poll(4)
        host.dispatch('timeUpdate', { previous: 1, current: 2 }) // resume 2
        expect(onStallEntered).toHaveBeenCalledTimes(2)
        expect(onStallEnded).toHaveBeenCalledTimes(2)
    })

    it('stops reporting after disposal', async () => {
        monitor()
        host.dispatch('playing', {})
        stop!()
        await poll(8)
        expect(onStallEntered).not.toHaveBeenCalled()
    })
})
