/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createUnreliablePlaybackEventsPatch,
    MIN_PLAYING_BEFORE_FAB,
    MIN_STALLED_BEFORE_FAB,
    requiresUnreliablePlaybackEventsPatch,
    UNRELIABLE_EVENTS_POLL_INTERVAL as POLL_INTERVAL,
} from '@amazon/vinyl'
import {
    type EventHandler,
    type PatchedRef,
    patchTarget,
    setUserAgent,
} from '@amazon/vinyl-util'
import {
    implementEventFakes,
    MockHTMLAudioElement,
    mockEvent,
    polyfillCustomEvent,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

describe('createUnreliablePlaybackEventsPatch', () => {
    let waitingSpy: Spy<EventHandler<Event>>
    let playingSpy: Spy<EventHandler<Event>>
    let canPlaySpy: Spy<EventHandler<Event>>
    let canPlayThroughSpy: Spy<EventHandler<Event>>
    let patchedMedia: HTMLMediaElement
    let media: MockHTMLAudioElement
    let patchedRef: PatchedRef<MockHTMLAudioElement>
    let disposed = false

    const clock = useMockTime()
    polyfillCustomEvent()

    beforeEach(() => {
        disposed = false
        media = new MockHTMLAudioElement()
        media.playbackRate = 1
        implementEventFakes(media)
        media.play.and.returnValue(Promise.resolve())
        patchedRef = patchTarget<
            MockHTMLAudioElement,
            HTMLMediaElementEventMap
        >(media, createUnreliablePlaybackEventsPatch)
        patchedMedia = patchedRef.patched

        waitingSpy = createSpy('waiting')
        patchedMedia.addEventListener('waiting', waitingSpy)
        playingSpy = createSpy('playing')
        patchedMedia.addEventListener('playing', playingSpy)
        canPlaySpy = createSpy('canplay')
        patchedMedia.addEventListener('canplay', canPlaySpy)
        canPlayThroughSpy = createSpy('canplaythrough')
        patchedMedia.addEventListener('canplaythrough', canPlayThroughSpy)
    })

    afterEach(() => {
        if (!disposed) patchedRef.dispose()
    })

    /**
     * Simulates media play-head progressing.
     */
    async function simulateTimeProgress() {
        const n = Math.floor(MIN_PLAYING_BEFORE_FAB / POLL_INTERVAL) + 1
        for (let i = 0; i <= n; i++) {
            media.currentTime = i * POLL_INTERVAL
            // First poll is to set to apparent PLAYING state, continue until MIN_PLAYING_BEFORE_FAB has elapsed.
            await clock.tick(POLL_INTERVAL) // polls n + 1 times
        }
    }

    /**
     * Simulates media play-head not progressing.
     */
    async function simulateTimeStalled() {
        const n = Math.floor(MIN_STALLED_BEFORE_FAB / POLL_INTERVAL) + 1
        for (let i = 0; i <= n; i++) {
            // First poll is to set to apparent STOPPED state, continue until MIN_STALLED_BEFORE_FAB has elapsed.
            await clock.tick(POLL_INTERVAL) // polls n + 1 times
        }
    }

    describe('waiting', () => {
        describe('when playing', () => {
            beforeEach(() => {
                media.paused = false
                media.readyState = media.HAVE_FUTURE_DATA
                media.dispatchEvent(mockEvent('playing'))
            })

            describe('and playback is progressing', () => {
                beforeEach(async () => {
                    await simulateTimeProgress()
                })

                it('does not fabricate a waiting event', () => {
                    expect(waitingSpy).not.toHaveBeenCalled()
                })

                describe('then playback is paused', () => {
                    beforeEach(() => {
                        media.paused = true
                    })

                    it('does not fabricate a waiting event', async () => {
                        await simulateTimeStalled()
                        expect(waitingSpy).not.toHaveBeenCalled()
                    })
                })

                describe('then playback is ended', () => {
                    beforeEach(() => {
                        media.ended = true
                    })

                    it('does not fabricate a waiting event', async () => {
                        await simulateTimeStalled()
                        expect(waitingSpy).not.toHaveBeenCalled()
                    })
                })
            })

            describe('when playback stalls', () => {
                beforeEach(async () => {
                    media.paused = false
                    media.readyState = media.HAVE_FUTURE_DATA
                    media.dispatchEvent(mockEvent('playing'))
                    // Wait for three polls, if time has not progressed, the waiting event will be fabricated.
                    await simulateTimeStalled()
                })

                it('fabricates waiting event', () => {
                    expect(waitingSpy).toHaveBeenCalledTimes(1)
                })

                it('overrides readyState to be at most HAVE_METADATA', () => {
                    expect(patchedMedia.readyState).toEqual(media.HAVE_METADATA)
                })

                describe('then a real waiting event is observed', () => {
                    it('does not emit an extra waiting event', async () => {
                        waitingSpy.calls.reset()
                        media.dispatchEvent(mockEvent('waiting')) // real event squelched
                        expect(waitingSpy).not.toHaveBeenCalled()
                        await simulateTimeStalled()
                        // Does not fabricate a new waiting event
                        expect(waitingSpy).not.toHaveBeenCalled()
                    })
                })

                describe('and playback resumes', () => {
                    beforeEach(() => {
                        playingSpy.calls.reset()
                    })

                    it('fabricates a playing event', async () => {
                        await simulateTimeProgress()
                        expect(canPlaySpy).toHaveBeenCalledTimes(1)
                        canPlaySpy.calls.reset()
                        expect(playingSpy).toHaveBeenCalledTimes(1)
                        playingSpy.calls.reset()
                        // if a real playing event is emitted after the fabricated one,
                        // should not re-emit another playing
                        media.dispatchEvent(mockEvent('playing'))
                        expect(playingSpy).not.toHaveBeenCalled()
                    })

                    describe('and readyState is HAVE_FUTURE_DATA', () => {
                        describe('when canplay or canplaythrough was not observed', () => {
                            beforeEach(() => {
                                media.readyState = media.HAVE_FUTURE_DATA
                            })

                            it('fabricates canplay', async () => {
                                await simulateTimeProgress()
                                expect(canPlayThroughSpy).not.toHaveBeenCalled()
                                expect(canPlaySpy).toHaveBeenCalledTimes(1)
                                expect(playingSpy).toHaveBeenCalledTimes(1)
                                expect(patchedMedia.readyState).toBe(
                                    media.HAVE_FUTURE_DATA
                                )
                            })

                            describe('then a real canplay event is observed', () => {
                                it('does not emit canplay again', async () => {
                                    await simulateTimeProgress()
                                    canPlaySpy.calls.reset()
                                    media.dispatchEvent(mockEvent('canplay'))
                                    expect(canPlaySpy).not.toHaveBeenCalled()
                                })
                            })
                        })
                    })

                    describe('and readyState is HAVE_ENOUGH_DATA', () => {
                        beforeEach(() => {
                            media.readyState = media.HAVE_ENOUGH_DATA
                        })

                        describe('when canplaythrough was not observed', () => {
                            describe('when canplay was not observed', () => {
                                it('fabricates canplay and canplaythrough', async () => {
                                    await simulateTimeProgress()
                                    expect(canPlaySpy).toHaveBeenCalledTimes(1)
                                    expect(
                                        canPlayThroughSpy
                                    ).toHaveBeenCalledTimes(1)
                                    expect(playingSpy).toHaveBeenCalledTimes(1)
                                    expect(patchedMedia.readyState).toBe(
                                        media.HAVE_ENOUGH_DATA
                                    )
                                })
                            })

                            describe('when canplay was observed', () => {
                                beforeEach(() => {
                                    media.dispatchEvent(mockEvent('canplay'))
                                    canPlaySpy.calls.reset()
                                })

                                it('fabricates canplaythrough but not canplay', async () => {
                                    await simulateTimeProgress()
                                    expect(canPlaySpy).not.toHaveBeenCalled()
                                    expect(
                                        canPlayThroughSpy
                                    ).toHaveBeenCalledTimes(1)
                                    expect(playingSpy).toHaveBeenCalledTimes(1)
                                    expect(patchedMedia.readyState).toBe(
                                        media.HAVE_ENOUGH_DATA
                                    )
                                })

                                describe('then a real canplaythrough event was observed', () => {
                                    it('does not emit canplaythrough a second time', async () => {
                                        await simulateTimeProgress()
                                        canPlayThroughSpy.calls.reset()
                                        media.dispatchEvent(
                                            mockEvent('canplaythrough')
                                        )
                                        expect(
                                            canPlayThroughSpy
                                        ).not.toHaveBeenCalled()
                                    })
                                })
                            })
                        })

                        describe('when canplaythrough was observed', () => {
                            beforeEach(() => {
                                media.dispatchEvent(mockEvent('canplaythrough'))
                                canPlayThroughSpy.calls.reset()
                            })

                            it('does not fabricate canplaythrough', async () => {
                                await simulateTimeProgress()
                                expect(canPlaySpy).not.toHaveBeenCalled()
                                expect(canPlayThroughSpy).not.toHaveBeenCalled()
                            })
                        })
                    })

                    describe('then a real playing event is observed', () => {
                        it('does not fabricate an extra playing event', async () => {
                            playingSpy.calls.reset()
                            media.dispatchEvent(mockEvent('waiting'))
                            media.currentTime = 0
                            await clock.tick(POLL_INTERVAL)
                            media.dispatchEvent(mockEvent('playing'))
                            playingSpy.calls.reset()
                            await simulateTimeProgress()
                            expect(playingSpy).not.toHaveBeenCalled()
                        })
                    })
                })
            })

            describe('then a waiting event is observed', () => {
                beforeEach(() => {
                    media.dispatchEvent(mockEvent('waiting'))
                    waitingSpy.calls.reset()
                })

                describe('then playback stalls', () => {
                    beforeEach(async () => {
                        await simulateTimeStalled()
                    })

                    it('does not fabricate a waiting event', () => {
                        expect(waitingSpy).not.toHaveBeenCalled()
                    })
                })
            })

            describe('when a canplay event has been observed', () => {
                describe('when a canplay event has not been fabricated', () => {
                    it('does not squelch the event', () => {
                        media.dispatchEvent(mockEvent('canplay'))
                        expect(canPlaySpy).toHaveBeenCalledTimes(1)
                    })
                })
            })

            describe('when a canplaythrough event has been observed', () => {
                describe('when a canplaythrough event has not been fabricated', () => {
                    it('does not squelch the event', () => {
                        media.dispatchEvent(mockEvent('canplaythrough'))
                        expect(canPlayThroughSpy).toHaveBeenCalledTimes(1)
                    })
                })
            })
        })

        describe('when not playing', () => {
            beforeEach(async () => {
                media.paused = true
                await simulateTimeStalled()
            })

            it('does not fabricate a waiting event', () => {
                expect(waitingSpy).not.toHaveBeenCalled()
            })

            describe('then play is observed', () => {
                beforeEach(() => {
                    media.paused = false
                    media.dispatchEvent(mockEvent('play'))
                })

                it('waits at least MIN_STALLED_BEFORE_FAB before allowing waiting fabrications', async () => {
                    expect(waitingSpy).not.toHaveBeenCalled()
                    await clock.tick(MIN_STALLED_BEFORE_FAB - 0.01)
                    expect(waitingSpy).not.toHaveBeenCalled()
                    await simulateTimeStalled()
                    expect(waitingSpy).toHaveBeenCalledTimes(1)
                })
            })
        })

        describe('when patch is disposed', () => {
            beforeEach(() => {
                disposed = true
                patchedRef.dispose()
            })

            it('does not fabricate a waiting event', async () => {
                media.paused = false
                media.readyState = media.HAVE_FUTURE_DATA
                await simulateTimeStalled()
                expect(waitingSpy).not.toHaveBeenCalled()
            })

            it('does not fabricate a playing event', async () => {
                media.paused = false
                media.readyState = media.HAVE_FUTURE_DATA
                await simulateTimeProgress()
                expect(playingSpy).not.toHaveBeenCalled()
            })
        })
    })

    describe('playing', () => {
        describe('and playback is paused', () => {
            beforeEach(() => {
                media.paused = true
            })

            describe('and content is ready to play', () => {
                beforeEach(() => {
                    media.readyState = media.HAVE_FUTURE_DATA
                })

                describe('and playback is detected', () => {
                    beforeEach(async () => {
                        await simulateTimeProgress()
                    })

                    it('does not fabricate playing', () => {
                        expect(playingSpy).not.toHaveBeenCalledTimes(1)
                    })
                })
            })
        })

        describe('and playback is not paused', () => {
            beforeEach(() => {
                media.paused = false
            })

            describe('and content is ready to play', () => {
                beforeEach(() => {
                    media.readyState = media.HAVE_FUTURE_DATA
                })

                describe('and playback is ended', () => {
                    beforeEach(() => {
                        media.ended = true
                    })

                    describe('and playback is detected', () => {
                        beforeEach(async () => {
                            await simulateTimeProgress()
                        })

                        it('does not fabricate playing', () => {
                            expect(playingSpy).not.toHaveBeenCalledTimes(1)
                        })
                    })
                })

                describe('and media is seeking', () => {
                    describe('and playback is detected', () => {
                        beforeEach(async () => {
                            media.dispatchEvent(mockEvent('seeking'))
                            await simulateTimeProgress()
                        })

                        it('does not fabricate a playing event', () => {
                            expect(playingSpy).not.toHaveBeenCalled()
                        })

                        describe('and media finishes seeking', () => {
                            beforeEach(() => {
                                media.dispatchEvent(mockEvent('seeked'))
                            })

                            it('fabricates a playing event', async () => {
                                await simulateTimeProgress()
                                expect(playingSpy).toHaveBeenCalledTimes(1)
                            })
                        })
                    })
                })

                describe('and playback is detected', () => {
                    beforeEach(async () => {
                        await simulateTimeProgress()
                    })

                    it('fabricates a playing event', async () => {
                        expect(playingSpy).toHaveBeenCalledTimes(1)

                        // if actual playing event comes after fabricated event do not emit another.
                        playingSpy.calls.reset()
                        media.dispatchEvent(mockEvent('playing'))
                        expect(playingSpy).not.toHaveBeenCalled()

                        // timeupdate events should not cause another fabricated
                        // playing
                        await simulateTimeProgress()
                        expect(playingSpy).not.toHaveBeenCalled()
                    })
                })

                describe('and real playback event is emitted', () => {
                    it('does not squelch real playback event', async () => {
                        media.dispatchEvent(mockEvent('playing'))
                        expect(playingSpy).toHaveBeenCalledTimes(1)
                        playingSpy.calls.reset()

                        // Does not fabricate another playing event
                        media.dispatchEvent(mockEvent('playing'))
                        await simulateTimeProgress()
                        expect(playingSpy).not.toHaveBeenCalled()
                    })
                })
            })

            describe('and content is buffering', () => {
                beforeEach(() => {
                    media.readyState = media.HAVE_METADATA
                })

                describe('and playback is detected', () => {
                    beforeEach(async () => {
                        await simulateTimeProgress()
                    })

                    it('does not fabricate a playing event', () => {
                        expect(playingSpy).not.toHaveBeenCalled()
                    })

                    describe('then content buffers', () => {
                        beforeEach(() => {
                            media.readyState = media.HAVE_FUTURE_DATA
                            media.dispatchEvent(mockEvent('canplay'))
                        })

                        describe('and playback is detected', () => {
                            beforeEach(async () => {
                                await simulateTimeProgress()
                            })

                            it('fabricates a playing event', () => {
                                expect(playingSpy).toHaveBeenCalledTimes(1)
                            })
                        })
                    })
                })
            })
        })
    })
})

describe('requiresUnreliablePlaybackEventsPatch', () => {
    function testForUa(userAgent: string, expected: boolean) {
        setUserAgent(userAgent)
        expect(requiresUnreliablePlaybackEventsPatch())
            .withContext(`requiresUnreliablePlayingEventsPatch`)
            .toEqual(expected)
    }

    it('is true when browser is Safari, Edge Legacy, or Chromium <= 53', () => {
        testForUa('Version/17.2.1 Safari/605.1.15', true)
        testForUa('Edge/18.0.0 Safari/605.1.15', true)
        testForUa('Edg/108.0.0 Safari/605.1.15', false)
        testForUa('Chrome/120.0.0', false)
        testForUa('Chrome/54.0.0', false)
        testForUa('Chrome/53.9.0', true)
    })
})
