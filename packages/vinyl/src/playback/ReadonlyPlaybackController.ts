/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AnyRecord,
    ReadonlyEventHost,
    ReadonlyRanges,
    Timestamp,
} from '@amazon/vinyl-util'
import type { ChangeEvent } from '../event/ChangeEvent'
import type { BasicErrorEvent } from '../event/BasicErrorEvent'

export interface ProgressEvent {
    readonly loaded: number
    readonly total: number
}

export interface OperationCompletedEvent<K> {
    /**
     * The timestamp the operation began.
     */
    readonly started: Timestamp

    /**
     * The timestamp the operation completed.
     */
    readonly ended: Timestamp

    /**
     * The total number of seconds the operation took.
     */
    readonly duration: number

    /**
     * The reason the operation completed.
     */
    readonly reason: K
}

export interface PlayedEvent extends OperationCompletedEvent<PlayedReason> {
    /**
     * The total number of seconds elapsed for the track (using `currentTime`).
     */
    readonly playbackTime: number
}

/**
 * The reason playback has stopped.
 * These are source event types from the media element that all indicate playback has stopped.
 * @see PlaybackControllerEventMap
 */
export enum PlayedReason {
    EMPTIED = 'emptied',
    /**
     * Note - 'ended' reason is generally unused, however it is not part of the w3c spec to guarantee a 'pause' event
     * before 'ended'.
     */
    ENDED = 'ended',
    PAUSE = 'pause',
    SEEKING = 'seeking',
    WAITING = 'waiting',
}

/**
 * A list of all events that cause the 2nd-order 'played' event.
 */
export const playedReasons = [
    PlayedReason.EMPTIED,
    PlayedReason.ENDED,
    PlayedReason.PAUSE,
    PlayedReason.SEEKING,
    PlayedReason.WAITING,
] as const satisfies readonly PlayedReason[]

export interface PlayRejectedEvent {
    /**
     * The reason for the play() rejection.
     *
     * @see #isNotAllowedError
     */
    reason: any
}

export interface PlaybackControllerEventMap {
    /**
     * Fired when the resource was not fully loaded, but not as the result of an error.
     */
    readonly abort: AnyRecord

    /**
     * Fired when the user agent can play the media, but estimates that not enough data has been
     * loaded to play the media up to its end without having to stop for further buffering of
     * content.
     *
     * readyState will be at least {@link PlaybackReadyState.HAVE_FUTURE_DATA}
     */
    readonly canPlay: AnyRecord

    /**
     * Fired when the user agent can play the media, and estimates that enough data has been
     * loaded to play the media up to its end without having to stop for further buffering of content.
     *
     * readyState will be at least {@link PlaybackReadyState.HAVE_ENOUGH_DATA}
     */
    readonly canPlayThrough: AnyRecord

    /**
     * Fired when the duration attribute has been updated.
     */
    readonly durationChange: ChangeEvent<number>

    /**
     * Fired when the media has become empty; for example, this event is sent if the media has
     * already been loaded (or partially loaded), and the load() method is called to reload it.
     *
     * readyState will be {@link PlaybackReadyState.HAVE_NOTHING}
     */
    readonly emptied: AnyRecord

    /**
     * Fired when playback or streaming has stopped because the end of the media was reached or
     * because no further data is available.
     */
    readonly ended: AnyRecord

    /**
     * Dispatched when the media element dispatches an error.
     */
    readonly error: BasicErrorEvent

    /**
     * Fired when {@link ReadonlyPlaybackController.playIsPending} has changed.
     */
    readonly playIsPendingChange: ChangeEvent<boolean>

    /**
     * Fired when the frame at the current playback position of the media has finished loading;
     * often the first frame.
     *
     * readyState will be at least {@link PlaybackReadyState.HAVE_CURRENT_DATA}
     */
    readonly loadedData: AnyRecord

    /**
     * Fired when the metadata has been loaded.
     *
     * readyState will be at least {@link PlaybackReadyState.HAVE_METADATA}
     */
    readonly loadedMetadata: AnyRecord

    /**
     * Fired when the browser has started to load a resource.
     */
    readonly loadStart: AnyRecord

    /**
     * Fired when {@link ReadonlyPlaybackController.loop} is true and playback has looped to track beginning.
     */
    readonly looped: AnyRecord

    /**
     * Fired when the mute status has changed.
     */
    readonly mutedChange: ChangeEvent<boolean>

    /**
     * Fired when a request to pause an activity is handled and the activity has entered its paused
     * state, most commonly after the media has been paused through a call to the element's
     * pause() method.
     */
    readonly pause: AnyRecord

    /**
     * Fired when the paused property is changed from true to false, as a result of the play
     * method, or the autoplay attribute.
     */
    readonly play: AnyRecord

    /**
     * Fired if play() has been attempted, but rejected.
     */
    readonly playRejected: PlayRejectedEvent

    /**
     * Fired when playback has stopped, for any reason.
     *
     * When media begins playing, a `playing` event is emitted. If playback stops due to 'pause',
     * 'seeking', 'emptied', 'waiting', or 'ended', then `played` will be fired.
     */
    readonly played: PlayedEvent

    /**
     * Fired after playback is first started, and whenever it is restarted. For example, it is
     * fired when playback resumes after having been paused or delayed due to lack of data.
     */
    readonly playing: AnyRecord

    /**
     * Fired periodically as the browser loads a resource.
     */
    readonly progress: ProgressEvent

    /**
     * Fired when the playback rate has changed.
     */
    readonly rateChange: ChangeEvent<number>

    /**
     * Fired when {@link ReadonlyPlaybackController.readyState} has changed.
     *
     * This is fired when any of the following events have fired:
     * {@link loadedData},
     * {@link loadedMetadata}
     * {@link canPlay}
     * {@link canPlayThrough}
     * {@link emptied}
     * {@link waiting}
     */
    readonly readyStateChange: ChangeEvent<PlaybackReadyState>

    /**
     * Fired when a seek operation completed, the current playback position has changed, and the
     * Boolean seeking attribute is changed to false.
     */
    readonly seeked: OperationCompletedEvent<'seeked' | 'playing' | 'emptied'>

    /**
     * Fired when a seek operation starts, meaning the Boolean seeking attribute has changed to
     * true and the media is seeking a new position.
     */
    readonly seeking: AnyRecord

    /**
     * Fired when the time indicated by the currentTime attribute has been updated.
     */
    readonly timeUpdate: ChangeEvent<number>

    /**
     * Fired when the volume has changed.
     */
    readonly volumeChange: ChangeEvent<number>

    /**
     * Fired when playback has stopped because of a temporary lack of data.
     *
     * Note: this includes during initial loading or after a seek and data is needed to buffer.
     * Will not be emitted when paused.
     */
    readonly waiting: AnyRecord

    /**
     * Fired when waiting has completed.
     * This will be emitted after a waiting event when playback has resumed, paused, or unloaded.
     */
    readonly waited: OperationCompletedEvent<WaitedReason>

    /**
     * Playback is blocked waiting for a key.
     */
    readonly waitingForKey: AnyRecord

    /**
     * Emitted when the error state has been reset.
     */
    readonly reset: AnyRecord
}

/**
 * Reasons why a 'waiting' operation has ended.
 */
export enum WaitedReason {
    PLAYING = 'playing',
    PAUSE = 'pause',
    EMPTIED = 'emptied',
    SEEKING = 'seeking',
}

/**
 * A list of all events that cause the 2nd-order 'waited' event.
 */
export const waitedReasons = [
    WaitedReason.PLAYING,
    WaitedReason.PAUSE,
    WaitedReason.EMPTIED,
    WaitedReason.SEEKING,
] as const satisfies readonly WaitedReason[]

export const ALL_PLAYBACK_STATE_EVENTS = [
    'abort',
    'canPlay',
    'canPlayThrough',
    'durationChange',
    'emptied',
    'ended',
    'error',
    'playIsPendingChange',
    'loadedData',
    'loadedMetadata',
    'loadStart',
    'looped',
    'mutedChange',
    'pause',
    'play',
    'playRejected',
    'played',
    'playing',
    'progress',
    'rateChange',
    'readyStateChange',
    'reset',
    'seeked',
    'seeking',
    'timeUpdate',
    'volumeChange',
    'waited',
    'waiting',
    'waitingForKey',
] as const satisfies readonly (keyof PlaybackControllerEventMap)[]

export enum PlaybackReadyState {
    /**
     * No information is available about the media resource.
     *
     * readyState will be this after `emptied`
     */
    HAVE_NOTHING = 0,

    /**
     * Enough of the media resource has been retrieved that the metadata attributes are initialized
     * Seeking will no longer raise an exception.
     *
     * readyState will be at least this after `loadedMetadata`
     */
    HAVE_METADATA = 1,

    /**
     * Data is available for the current playback position, but not enough to actually play more
     * than one frame.
     *
     * readyState will be at least this after `loadedData`
     */
    HAVE_CURRENT_DATA = 2,

    /**
     * Data for the current playback position as well as for at least a little bit of time into the
     * future is available (in other words, at least two frames of video, for example).
     *
     * readyState will be at least this after `canPlay`
     */
    HAVE_FUTURE_DATA = 3,

    /**
     * Enough data is available—and the download rate is high enough—that the media can be played
     * through to the end without interruption.
     *
     * readyState will be at least this after `canPlayThrough`
     */
    HAVE_ENOUGH_DATA = 4,
}

/**
 * An enumeration of possible networkState values on a media element.
 */
export enum PlaybackNetworkState {
    /**
     * There is no data yet. Also, readyState is HAVE_NOTHING.
     */
    NETWORK_EMPTY = 0,

    /**
     * HTMLMediaElement is active and has selected a resource, but is not using the network.
     */
    NETWORK_IDLE = 1,

    /**
     * The browser is downloading HTMLMediaElement data.
     */
    NETWORK_LOADING = 2,

    /**
     * No HTMLMediaElement src found.
     */
    NETWORK_NO_SOURCE = 3,
}

export interface ReadonlyPlaybackController extends ReadonlyEventHost<PlaybackControllerEventMap> {
    /**
     * Returns a new static normalized ReadonlyRanges object that represents the ranges of the
     * media resource, if any, that the user agent has buffered at the moment the buffered
     * property is accessed.
     *
     * Note: `ReadonlyRanges` is a view to the DOM `TimeRanges` object.
     */
    readonly buffered: ReadonlyRanges

    /**
     * True if the {@link readyState} is {@link PlaybackReadyState.HAVE_FUTURE_DATA}
     * This will be true after a {@link PlaybackControllerEventMap.canPlay} event.
     *
     * Note that security permissions may not allow a track to load past metadata before there has
     * been a user interaction. This should not be relied upon before invoking
     * {@link PlaybackController.play}.
     */
    readonly canPlay: boolean

    /**
     * True if the {@link readyState} is {@link PlaybackReadyState.HAVE_ENOUGH_DATA}
     * This will be true after a {@link PlaybackControllerEventMap.canPlayThrough} event.
     *
     * Note that security permissions may not allow a track to load past metadata before there has
     * been a user interaction. This should not be relied upon before invoking
     * {@link PlaybackController.play}.
     */
    readonly canPlayThrough: boolean

    /**
     * The current playback time in seconds.
     * When changed, a 'timeUpdate' event is emitted.
     */
    readonly currentTime: number

    /**
     * Returns current time as a percent of the total duration.
     *
     * @return A number between 0-1
     */
    readonly currentTimePercent: number

    /**
     * The default playback rate when the user is not using fast forward or reverse for a
     * video or audio resource.
     */
    readonly defaultPlaybackRate: number

    /**
     * The length of the element's media in seconds.
     * Observe changes with `durationChange` events.
     */
    readonly duration: number

    /**
     * Indicates whether the media element has ended playback.
     */
    readonly ended: boolean

    /**
     * The Error object for the most recent error, or null if there has not been an error.
     * When an error event is received by the element, you can determine details about what
     * happened by examining this object.
     */
    readonly error: Error | null

    /**
     * True if the {@link readyState} is at least {@link PlaybackReadyState.HAVE_METADATA}
     *
     * This will be true after a {@link PlaybackControllerEventMap.loadedMetadata} event and
     * false after an {@link PlaybackControllerEventMap.emptied} event.
     */
    readonly hasMetadata: boolean

    /**
     * Controls whether the media element should start over when it reaches the end.
     */
    readonly loop: boolean

    /**
     * Indicates whether the media element muted.
     * Observe changes with `mutedChange` events.
     */
    readonly muted: boolean

    /**
     * Indicates the current state of the fetching of media over the network.
     */
    readonly networkState: PlaybackNetworkState

    /**
     * Indicates whether the media element is paused.
     * Observe changes with `play` and `pause` events.
     */
    readonly paused: boolean

    /**
     * Sets the rate at which the media is being played back. This is used to implement user
     * controls for fast-forward, slow motion, and so forth. The normal playback rate is
     * multiplied by this value to obtain the current rate, so a value of 1.0 indicates normal
     * speed.
     */
    readonly playbackRate: number

    /**
     * True if playback has started, is not paused, stalled, or seeking.
     * Observe changes with 'playing' and 'played' events.
     */
    readonly playing: boolean

    /**
     * True if `play` has been called and the returned promise is currently in a pending state.
     * Observe changes with {@link PlaybackControllerEventMap.playIsPendingChange} events.
     */
    readonly playIsPending: boolean

    /**
     * Determines whether the browser should adjust the pitch of the audio to compensate
     * for changes to the playback rate.
     * Default: true
     */
    readonly preservesPitch: boolean

    /**
     * Indicates the readiness state of the media.
     * Observe changes with {@link PlaybackControllerEventMap.readyStateChange} events.
     */
    readonly readyState: PlaybackReadyState

    /**
     * Returns a new static normalized `ReadonlyRanges` object that represents the ranges of the
     * media resource, if any, that the user agent is able to seek to at the time seekable
     * property is accessed.
     *
     * Note: `ReadonlyRanges` is a view to the DOM `TimeRanges` object.
     */
    readonly seekable: ReadonlyRanges

    /**
     * True if the element is currently seeking.
     * Observe changes with `seeking` and `seeked` events.
     */
    readonly seeking: boolean

    /**
     * The volume level for audio portions of the media element.
     * Observe changes with `volumeChange` events.
     */
    readonly volume: number

    /**
     * True if playback is stopped due to waiting for data.
     * Observe changes with `waiting` and `waited` events.
     */
    readonly waiting: boolean
}
