/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createStallDetector, type StallDetectorOptions } from '@amazon/vinyl'
import {
    implementEventFakes,
    MockHTMLAudioElement,
    mockEvent,
    MockTimeRanges,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import Spy = jasmine.Spy

describe('createStallDetector', () => {
    const clock = useMockTime()
    let media: MockHTMLAudioElement
    let fabricatePlaying: Spy<() => void>
    let stop: (() => void) | undefined

    beforeEach(() => {
        media = new MockHTMLAudioElement()
        implementEventFakes(media)
        media.play.and.returnValue(Promise.resolve())
        media.paused = false
        media.ended = false
        media.readyState = media.HAVE_ENOUGH_DATA
        media.currentTime = 10
        media.buffered = new MockTimeRanges([[0, 100]])
        fabricatePlaying = jasmine.createSpy('fabricatePlaying')
    })

    afterEach(() => {
        stop?.()
    })

    function detect(overrides: Partial<StallDetectorOptions> = {}) {
        stop = createStallDetector(media, { fabricatePlaying, ...overrides })
    }

    /** Advances the mock clock by `n` default poll intervals. */
    async function poll(n: number) {
        for (let i = 0; i < n; i++) {
            await clock.tick(0.25)
        }
    }

    describe('a stall inside ready buffered data', () => {
        it('nudges the play head once frozen past the stall threshold', async () => {
            detect()
            // Threshold is 0.75s = three polls; the third nudges by stallSkip.
            await poll(3)
            expect(media.currentTime).toBeCloseTo(10.1)
        })

        it('does not recover before the stall threshold', async () => {
            detect()
            await poll(2)
            expect(media.currentTime).toBe(10)
            expect(media.play).not.toHaveBeenCalled()
        })

        it('nudges even when the ready state is low (iOS reports a stale readyState)', async () => {
            media.readyState = media.HAVE_METADATA
            detect()
            await poll(3)
            expect(media.currentTime).toBeCloseTo(10.1)
            expect(media.play).not.toHaveBeenCalled()
        })

        it('keeps nudging, then gives up after maxAttempts', async () => {
            detect()
            // Default maxAttempts is 3, so at most three nudges (one every 3 polls).
            await poll(12)
            expect(media.currentTime).toBeCloseTo(10.3)
            // Further polls do nothing; the detector has stopped.
            await poll(6)
            expect(media.currentTime).toBeCloseTo(10.3)
        })
    })

    describe('a stall with no data at the playhead', () => {
        it('does not recover when the playhead is outside all buffered ranges', async () => {
            media.buffered = new MockTimeRanges([[50, 100]])
            detect()
            await poll(6)
            expect(media.currentTime).toBe(10)
            expect(fabricatePlaying).not.toHaveBeenCalled()
        })

        it('does not recover at the end of buffered data', async () => {
            // Within the default end margin (0.5s) of the buffer end.
            media.buffered = new MockTimeRanges([[0, 10.3]])
            detect()
            await poll(6)
            expect(media.currentTime).toBe(10)
        })

        it('nudges at the end of the media (stuck end-of-track on src)', async () => {
            // Buffer ends at the media duration: no more data is coming, so a
            // freeze here is a stuck end-of-track and a nudge drives it to end.
            media.buffered = new MockTimeRanges([[0, 10.3]])
            media.duration = 10.3
            detect()
            await poll(3)
            expect(media.currentTime).toBeCloseTo(10.1)
        })

        it('nudges outside buffered ranges when nudgeUnbuffered is set', async () => {
            // WebKit path: re-issue the seek even though buffered looks empty.
            media.buffered = new MockTimeRanges([[50, 100]])
            detect({ nudgeUnbuffered: true })
            await poll(3)
            expect(media.currentTime).toBeCloseTo(10.1)
        })

        it('stops when the source is emptied', async () => {
            detect()
            media.dispatchEvent(mockEvent('emptied'))
            // Stopped: a later freeze in buffered data is not nudged.
            await poll(6)
            expect(media.currentTime).toBe(10)
        })
    })

    describe('fabricating a playing event', () => {
        it('fabricates when the head progresses without a playing event', async () => {
            detect()
            media.currentTime = 20
            await poll(1)
            expect(fabricatePlaying).toHaveBeenCalledTimes(1)
            // Detector stopped; a later freeze is not recovered.
            await poll(6)
            expect(media.play).not.toHaveBeenCalled()
        })

        it('does not fabricate when a real playing event fired and it keeps progressing', async () => {
            detect()
            media.dispatchEvent(mockEvent('playing'))
            media.currentTime = 20
            await poll(6)
            expect(fabricatePlaying).not.toHaveBeenCalled()
        })

        it('fabricates after reviving a stall even if a playing event fired earlier', async () => {
            // iOS pattern: a playing event fires, then playback stalls.
            media.readyState = media.HAVE_METADATA
            detect()
            media.dispatchEvent(mockEvent('playing'))
            await poll(3)
            expect(media.currentTime).toBeCloseTo(10.1) // nudged (recovered)
            // The recovery revives playback.
            media.currentTime = 11
            await poll(1)
            expect(fabricatePlaying).toHaveBeenCalledTimes(1)
        })
    })

    describe('when the element is not advancing by design', () => {
        it('does not recover while paused', async () => {
            media.paused = true
            detect()
            await poll(6)
            expect(media.play).not.toHaveBeenCalled()
            expect(media.currentTime).toBe(10)
        })

        it('does not recover once ended', async () => {
            media.ended = true
            detect()
            await poll(6)
            expect(media.play).not.toHaveBeenCalled()
            expect(media.currentTime).toBe(10)
        })
    })

    it('honors provided options', async () => {
        detect({
            pollInterval: 0.5,
            stallThreshold: 1,
            bufferEndMargin: 0.2,
            stallSkip: 0.25,
            maxAttempts: 1,
        })
        // Threshold 1s = two 0.5s polls; one nudge of 0.25, then it gives up.
        for (let i = 0; i < 6; i++) await clock.tick(0.5)
        expect(media.currentTime).toBeCloseTo(10.25)
    })
})
