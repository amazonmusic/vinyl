/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlaybackEngine, type QualityInfo, type Track } from './playbackEngine'
import type { CapabilitiesImplDeps, VinylPlayer } from '@amazon/vinyl'

export class VinylEngine extends PlaybackEngine {
    private player!: VinylPlayer

    static async create(media: HTMLAudioElement): Promise<VinylEngine> {
        const engine = new VinylEngine(media)
        await engine.initialize()
        return engine
    }

    protected async initialize(): Promise<void> {
        const { createVinylPlayer, CapabilitiesImpl } = await import(
            '@amazon/vinyl'
        )
        const { max, compareBy } = await import('@amazon/vinyl-util')

        // Disable sample-rate filtering for apples-to-apples ABR comparisons:
        // Shaka doesn't filter renditions by AudioContext sample rate, so
        // Vinyl shouldn't either here.
        class UnlimitedSampleRateCapabilities extends CapabilitiesImpl {
            override get sampleRate(): number {
                return Number.POSITIVE_INFINITY
            }
        }

        this.player = createVinylPlayer(
            {
                media: this.media,
                abr: {
                    // Allows ABR-up cross codec, (what shaka does, keeps comparisons similar).
                    restrictDecoderChangeOnAudioAbrUp: false,
                },
            },
            {
                capabilities: (deps: CapabilitiesImplDeps) =>
                    new UnlimitedSampleRateCapabilities(deps),
            }
        )

        this.player.on('qualitiesChange', (e: any) => {
            const maxBandwidth = max(
                e.current,
                compareBy((m: any) => m.bandwidthTotal)
            )?.bandwidthTotal
            if (maxBandwidth) {
                this.notifyMaxBandwidth(maxBandwidth)
            }
        })

        this.player.on('playbackQualityChange', () => {
            this.qualityCallback?.(this.getCurrentQuality())
        })
    }

    load(track: Track): Promise<void> {
        this.player.load(track)
        return Promise.resolve()
    }

    reset(): void {
        this.player.reset()
    }

    getCurrentQuality(): QualityInfo | null {
        const audio = this.player.getPlaybackQuality('audio')?.bandwidth ?? 0
        const video = this.player.getPlaybackQuality('video')?.bandwidth ?? 0
        const total = audio + video
        return total > 0 ? { bandwidth: total } : null
    }
}
