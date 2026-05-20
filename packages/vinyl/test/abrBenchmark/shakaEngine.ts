/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlaybackEngine, type QualityInfo, type Track } from './playbackEngine'

interface ShakaVariantTrack {
    bandwidth: number
    active: boolean
}

interface ShakaMediaQualityInfo {
    bandwidth: number
    contentType: string
}

interface ShakaMediaQualityChangedEvent extends Event {
    mediaQuality: ShakaMediaQualityInfo
    position: number
}

interface ShakaPlayer {
    load(uri: string): Promise<void>
    unload(): Promise<void>
    getVariantTracks(): ShakaVariantTrack[]
    configure(config: object): boolean
    addEventListener(event: string, handler: (e: Event) => void): void
}

interface ShakaGlobal {
    Player: new (media: HTMLMediaElement) => ShakaPlayer
}

const SHAKA_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.0/shaka-player.compiled.js'

let shakaScriptPromise: Promise<void> | null = null

function loadShakaScript(): Promise<void> {
    if (shakaScriptPromise) return shakaScriptPromise
    shakaScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = SHAKA_URL
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Shaka Player'))
        document.head.appendChild(script)
    })
    return shakaScriptPromise
}

export class ShakaEngine extends PlaybackEngine {
    private player!: ShakaPlayer
    private currentBandwidth: number | null = null

    static async create(media: HTMLAudioElement): Promise<ShakaEngine> {
        const engine = new ShakaEngine(media)
        await engine.initialize()
        return engine
    }

    protected async initialize(): Promise<void> {
        await loadShakaScript()
        const shaka = (globalThis as unknown as { shaka: ShakaGlobal }).shaka
        this.player = new shaka.Player(this.media)

        // Enable `mediaqualitychanged` events, which fire when the quality
        // at the current playback position changes (not when the streamed
        // variant changes, which may still be buffering ahead).
        this.player.configure({ streaming: { observeQualityChanges: true } })

        const reportMaxBandwidth = () => {
            const tracks = this.player.getVariantTracks()
            if (tracks.length > 0) {
                this.notifyMaxBandwidth(
                    Math.max(...tracks.map((t) => t.bandwidth))
                )
            }
        }

        // `loaded` covers the initial variant list becoming available.
        this.player.addEventListener('loaded', reportMaxBandwidth)

        // `mediaqualitychanged` fires when the playhead enters a region
        // buffered at a different quality, so it reflects what's actually
        // playing rather than what's being fetched.
        this.player.addEventListener('mediaqualitychanged', (e: Event) => {
            const event = e as ShakaMediaQualityChangedEvent
            this.currentBandwidth = event.mediaQuality.bandwidth
            this.qualityCallback?.(this.getCurrentQuality())
        })
    }

    async load(track: Track): Promise<void> {
        await this.player.load(track.uri)
    }

    reset(): void {
        void this.player.unload()
        this.currentBandwidth = null
    }

    getCurrentQuality(): QualityInfo | null {
        return this.currentBandwidth != null
            ? { bandwidth: this.currentBandwidth }
            : null
    }
}
