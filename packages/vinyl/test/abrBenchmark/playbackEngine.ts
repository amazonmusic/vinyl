/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QualityInfo {
    bandwidth: number | null
}

export interface Track {
    type: 'dash' | 'hls'
    uri: string
}

type Listener<T> = (value: T) => void

export abstract class PlaybackEngine {
    protected media: HTMLAudioElement

    private playingCallback?: () => void
    private waitingCallback?: () => void
    private pauseCallback?: () => void
    private emptiedCallback?: () => void
    private endedCallback?: () => void
    private maxBandwidthCallback?: Listener<number | null>
    protected qualityCallback?: Listener<QualityInfo | null>

    protected constructor(media: HTMLAudioElement) {
        this.media = media
        this.media.addEventListener('playing', () => this.playingCallback?.())
        this.media.addEventListener('waiting', () => this.waitingCallback?.())
        this.media.addEventListener('pause', () => this.pauseCallback?.())
        this.media.addEventListener('emptied', () => this.emptiedCallback?.())
        this.media.addEventListener('ended', () => this.endedCallback?.())
    }

    protected abstract initialize(): Promise<void>
    abstract load(track: Track): Promise<void>
    abstract reset(): void
    abstract getCurrentQuality(): QualityInfo | null

    async play(): Promise<void> {
        await this.media.play()
    }

    onPlaying(callback: () => void) {
        this.playingCallback = callback
    }
    onWaiting(callback: () => void) {
        this.waitingCallback = callback
    }
    onPause(callback: () => void) {
        this.pauseCallback = callback
    }
    onEmptied(callback: () => void) {
        this.emptiedCallback = callback
    }
    onEnded(callback: () => void) {
        this.endedCallback = callback
    }
    onQualityChange(callback: Listener<QualityInfo | null>) {
        this.qualityCallback = callback
    }
    onMaxBandwidthChange(callback: Listener<number | null>) {
        this.maxBandwidthCallback = callback
    }

    protected notifyMaxBandwidth(maxBandwidth: number | null) {
        this.maxBandwidthCallback?.(maxBandwidth)
    }
}
