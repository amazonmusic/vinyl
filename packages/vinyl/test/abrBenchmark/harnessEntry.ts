/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Browser-side harness entry point.
 * Bundled by esbuild and loaded by harness.html.
 *
 * Collects a single event-driven timeline: each entry marks a state change
 * (playback start, rebuffer start/end, quality change, pause, end) with a
 * time (seconds from test start) and the bandwidth being played (null if not
 * playing). Between two consecutive samples the state described by the earlier
 * sample is held.
 */

import type { PlaybackEngine, Track } from './playbackEngine'
import type { TimelineEventType, TimelineSample } from './abrScore'
import { VinylEngine } from './vinylEngine'
import { ShakaEngine } from './shakaEngine'
import type { EngineType } from './bundleLoadTime'

const engineFactories: Record<
    EngineType,
    (media: HTMLAudioElement) => Promise<PlaybackEngine>
> = {
    vinyl: (media) => VinylEngine.create(media),
    shaka: (media) => ShakaEngine.create(media),
}

const media = document.getElementById('media') as HTMLMediaElement
let engine: PlaybackEngine | null = null

interface HarnessState {
    testStart: number
    playRequestTime: number | null
    initialDelaySeconds: number
    firstPlayingFired: boolean
    currentBandwidth: number | null
    maxBandwidth: number | null
    isPlaying: boolean
    /** Set on any `waiting` event after startup; cleared when read via getLiveState. */
    rebufferedSincePoll: boolean
    ended: boolean
    timeline: TimelineSample[]
}

function makeInitialState(): HarnessState {
    return {
        testStart: performance.now(),
        playRequestTime: null,
        initialDelaySeconds: 0,
        firstPlayingFired: false,
        currentBandwidth: null,
        maxBandwidth: null,
        isPlaying: false,
        rebufferedSincePoll: false,
        ended: false,
        timeline: [],
    }
}

let state: HarnessState = makeInitialState()

function elapsed(): number {
    return (performance.now() - state.testStart) / 1000
}

function push(event: TimelineEventType) {
    state.timeline.push({
        time: elapsed(),
        event,
        bandwidth: state.isPlaying ? state.currentBandwidth : null,
    })
}

function attachEngineListeners(engine: PlaybackEngine) {
    engine.onMaxBandwidthChange((maxBandwidth) => {
        if (maxBandwidth && maxBandwidth !== state.maxBandwidth) {
            state.maxBandwidth = maxBandwidth
        }
    })

    engine.onPlaying(() => {
        if (!state.firstPlayingFired && state.playRequestTime) {
            state.initialDelaySeconds =
                (performance.now() - state.playRequestTime) / 1000
            state.firstPlayingFired = true
        }
        if (!state.isPlaying) {
            state.isPlaying = true
            push('playing')
        }
    })

    engine.onWaiting(() => {
        // Only register a rebuffer if we had previously started playing;
        // pre-startup "waiting" is captured as startup delay.
        if (state.firstPlayingFired && state.isPlaying) {
            state.isPlaying = false
            state.rebufferedSincePoll = true
            push('waiting')
        }
    })

    engine.onPause(() => {
        if (state.isPlaying) {
            state.isPlaying = false
            push('paused')
        }
    })

    engine.onEnded(() => {
        state.ended = true
        state.isPlaying = false
        push('ended')
    })

    engine.onQualityChange((quality) => {
        console.log('engine on quality change:', quality)
        const bw = quality?.bandwidth ?? null
        if (bw !== state.currentBandwidth) {
            state.currentBandwidth = bw
            if (state.isPlaying) {
                push('qualityChange')
            }
        }
    })
}

export const testHarness = {
    async loadAndPlay(
        type: Track['type'],
        uri: string,
        engineType: EngineType
    ): Promise<void> {
        state = makeInitialState()

        if (!engine) {
            engine = await engineFactories[engineType](media)
            attachEngineListeners(engine)
        }

        state.playRequestTime = performance.now()

        const started = engine.load({ type, uri }).then(() => engine!.play())
        started.catch((err) => console.error('loadAndPlay failed:', err))
    },

    stop(): void {
        engine?.reset()
    },

    /**
     * Lightweight live snapshot for CLI progress rendering only — never
     * persisted. The recorded timeline remains event-driven.
     *
     * `rebufferedSinceLast` reports whether any rebuffer happened since the
     * previous call, so a transient waiting→playing transition within one
     * polling interval still surfaces in the CLI.
     */
    getLiveState() {
        const snapshot = {
            playing: state.isPlaying,
            started: state.firstPlayingFired,
            ended: state.ended,
            bandwidth: state.currentBandwidth,
            maxBandwidth: state.maxBandwidth,
            rebufferedSinceLast: state.rebufferedSincePoll,
        }
        state.rebufferedSincePoll = false
        return snapshot
    },

    getResult() {
        return {
            initialDelaySeconds: state.initialDelaySeconds,
            maxBandwidth: state.maxBandwidth,
            ended: state.ended,
            timeline: [...state.timeline],
            // Final elapsed time at the moment of read — used to close out the
            // last interval for timed-out (non-ended) runs.
            endTime: elapsed(),
        }
    },
}
;(globalThis as any).testHarness = testHarness
