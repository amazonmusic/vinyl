/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Browser, hasBrowser, type Timestamp } from '@amazon/vinyl-util'
import {
    closeTo,
    createDisposer,
    DomEventHost,
    onAny,
    SignalImpl,
} from '@amazon/vinyl-util'
import type { HtmlMediaElementPatch } from '@/patch/media/HtmlMediaElementPatch'

/**
 * The interval (in seconds) to poll for time progress in a media element.
 *
 * @private
 */
export const UNRELIABLE_EVENTS_POLL_INTERVAL = 0.2

/**
 * Minimum amount of time playback must be stalled before fabricating a waiting event.
 */
export const MIN_STALLED_BEFORE_FAB = 0.8

/**
 * Minimum amount of time playback must be progressing before fabricating a playing event.
 */
export const MIN_PLAYING_BEFORE_FAB = 0.4

/**
 * If currentTime does not change larger than this value, it will be considered to be stalled.
 */
const MIN_PLAYING_DELTA = 0.05

/**
 * If currentTime changes beyond this tolerance the apparent state will be considered to be seeking.
 */
const MIN_SEEKING_DELTA = 0.5

enum PlayHeadState {
    /**
     * The last time update was an increment from the previous.
     */
    PLAYING,

    /**
     * The last time update was close to the previous.
     */
    STOPPED,

    /**
     * The last time update was a non-incremental change.
     */
    SEEKING,
}

/**
 * Playback events such as playing, canPlay, and waiting are unreliable on this platform.
 * Watch playback state and fabricate events when necessary.
 */
export function createUnreliablePlaybackEventsPatch(
    media: HTMLMediaElement
): HtmlMediaElementPatch {
    const { add, dispose } = createDisposer()
    const domEvents = add(new DomEventHost<HTMLMediaElementEventMap>(media))
    const eventFabricated = add(new SignalImpl<Event>())

    // The timestamp of the last change.
    let stateChangedAt: Timestamp = Date.now()

    // The current observed state based on the play head progress.
    let currentApparentState: PlayHeadState = PlayHeadState.STOPPED

    /**
     * @param state The new apparent state.
     * @param changedAt The timestamp the apparent state was changed.
     */
    function setApparentState(
        state: PlayHeadState,
        changedAt: Timestamp = Date.now()
    ) {
        if (currentApparentState !== state) {
            currentApparentState = state
            stateChangedAt = changedAt
        }
    }

    /**
     * Returns the number of seconds since the last state change.
     */
    function elapsedStateTime(): number {
        return (Date.now() - stateChangedAt) / 1000
    }

    let lastTimestamp: Timestamp = Date.now()
    let lastTime = media.currentTime

    let waiting = false
    let seeking = false

    onAny(
        domEvents,
        ['emptied', 'ended', 'pause', 'playing', 'seeking'],
        () => {
            waiting = false
        }
    )

    let playing = false
    onAny(
        domEvents,
        ['emptied', 'ended', 'pause', 'seeking', 'waiting'],
        () => {
            playing = false
        }
    )

    domEvents.on('seeking', () => {
        seeking = true
    })
    domEvents.on('seeked', () => {
        seeking = false
        setApparentState(PlayHeadState.SEEKING)
    })
    domEvents.on('play', () => {
        // Resets the timer so that the !paused state does not immediately trigger a 'waiting' event.
        stateChangedAt = Date.now()
    })

    // All events that can affect the ready state.
    // canplay and canplaythrough are handled in the overridden events map.
    const readyStateEvents = [
        'emptied',
        'loadeddata',
        'loadedmetadata',
        'waiting',
    ] as const
    let lastReadyStateEvent = 'emptied'
    add(
        onAny(domEvents, readyStateEvents, (_, type) => {
            lastReadyStateEvent = type
        })
    )

    const checkApparentState = () => {
        const progressed = (media.currentTime - lastTime) / media.playbackRate
        const now = Date.now()
        if (Math.abs(progressed) > MIN_SEEKING_DELTA) {
            setApparentState(PlayHeadState.SEEKING, lastTimestamp)
        } else if (progressed >= MIN_PLAYING_DELTA) {
            setApparentState(PlayHeadState.PLAYING, lastTimestamp)
        } else if (closeTo(progressed, 0, MIN_PLAYING_DELTA)) {
            setApparentState(PlayHeadState.STOPPED, lastTimestamp)
        }
        lastTime = media.currentTime
        lastTimestamp = now

        if (
            !playing &&
            !seeking &&
            !media.paused &&
            !media.ended &&
            media.readyState >= media.HAVE_FUTURE_DATA &&
            currentApparentState === PlayHeadState.PLAYING &&
            elapsedStateTime() >= MIN_PLAYING_BEFORE_FAB
        ) {
            // The play head is progressing but a playing event was never observed.
            waiting = false
            playing = true

            if (
                lastReadyStateEvent !== 'canplay' &&
                lastReadyStateEvent !== 'canplaythrough'
            ) {
                lastReadyStateEvent = 'canplay'
                eventFabricated.dispatch(new CustomEvent('canplay'))
            }
            if (media.readyState >= media.HAVE_ENOUGH_DATA) {
                if (lastReadyStateEvent !== 'canplaythrough') {
                    lastReadyStateEvent = 'canplaythrough'
                    eventFabricated.dispatch(new CustomEvent('canplaythrough'))
                }
            }
            eventFabricated.dispatch(new CustomEvent('playing'))
        }
        if (
            !waiting &&
            !media.paused &&
            !media.ended &&
            currentApparentState === PlayHeadState.STOPPED &&
            elapsedStateTime() >= MIN_STALLED_BEFORE_FAB
        ) {
            waiting = true
            playing = false
            // currentTime is not changing; playback has stopped but no 'waiting' event
            // was observed.
            eventFabricated.dispatch(new CustomEvent('waiting'))
        }
    }

    const playbackWatchIntervalId = setInterval(
        checkApparentState,
        UNRELIABLE_EVENTS_POLL_INTERVAL * 1000
    )
    add(() => {
        clearInterval(playbackWatchIntervalId)
    })
    return {
        eventFabricated,
        properties: {
            /**
             * Platforms that have unreliable waiting events, also have unreliable ready state
             * when the end of buffered data has been reached. If the media is in a waiting state,
             * the highest ready state that is possible is HAVE_METADATA.
             */
            readyState: {
                get() {
                    return waiting
                        ? Math.min(media.readyState, media.HAVE_METADATA)
                        : media.readyState
                },
            },
        },
        events: {
            canplay(event) {
                // Do not emit the canplay event if one was fabricated.
                const eventOrNull =
                    lastReadyStateEvent === 'canplay' ? null : event
                lastReadyStateEvent = 'canplay'
                return eventOrNull
            },

            canplaythrough(event) {
                // Do not emit the canplaythrough event if one was fabricated.
                const eventOrNull =
                    lastReadyStateEvent === 'canplaythrough' ? null : event
                lastReadyStateEvent = 'canplaythrough'
                return eventOrNull
            },

            playing(event) {
                if (playing) {
                    // Do not emit the playing event if one was fabricated.
                    return null
                }
                setApparentState(PlayHeadState.PLAYING)
                playing = true
                return event
            },

            waiting(event) {
                if (waiting) {
                    // Do not emit the waiting event if one was fabricated.
                    return null
                }
                waiting = true
                setApparentState(PlayHeadState.STOPPED)
                return event
            },
        },

        dispose,
    }
}

/**
 * Chrome <= 53 has unreliable waiting events.
 * Safari, and Edge Legacy miss playing events after seeking.
 */
export function requiresUnreliablePlaybackEventsPatch(): boolean {
    return (
        hasBrowser(Browser.SAFARI) ||
        hasBrowser(Browser.EDGE_LEGACY) ||
        hasBrowser(Browser.CHROMIUM, null, '53')
    )
}
