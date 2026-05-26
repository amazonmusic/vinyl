/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsManifestData } from '@/track/hls/HlsManifestProvider'
import type { HlsMediaQualityMetadataResolver } from '@/track/hls/HlsMediaQualityMetadataResolver'
import type {
    ContentType,
    MediaQualityMetadata,
} from '@/streaming/MediaQualityMetadata'
import type {
    MediaPeriod,
    MediaQualityData,
    MediaTimeline,
} from '@/streaming/MediaTimeline'
import type { SegmentReference } from '@/streaming/SegmentReference'
import type { SegmentDataProvider } from '@/streaming/SegmentDataSlot'
import { buildSegmentTimeline } from '@/track/hls/util/hlsSegmentTime'
import { getSegmentAtTime } from '@/streaming/util/segment'
import { resolveUrl } from '@amazon/vinyl-util'
import { codecToContentType, contentTypeToMimeType } from '@/track/mse/codec'
import {
    createSegmentDataProvider,
    type CreateSegmentDataProviderDeps,
} from '@/track/createSegmentDataProvider'
import { hlsByteRangeToMediaRange } from '@/track/hls/util/hlsByteRangeToMediaRange'
import { createTransmuxer } from '@amazon/vinyl-transmux'

export interface BuildHlsMediaTimelineDeps extends CreateSegmentDataProviderDeps {
    readonly mediaQualityMetadataResolver: HlsMediaQualityMetadataResolver
}

/**
 * Builds a MediaTimeline from an HLS manifest.
 * HLS has a single implicit period spanning the full duration.
 */
export function buildHlsMediaTimeline(
    deps: BuildHlsMediaTimelineDeps,
    data: HlsManifestData
): MediaTimeline {
    const { mainPlaylist, baseUrl } = data
    const renditions = mainPlaylist.alternativeRenditions

    // HLS duration requires fetching a media playlist, so compute it lazily.
    const DEFAULT_MIN_BUFFER_TIME = 10

    const qualities: MediaQualityData[] = mainPlaylist.variants.flatMap(
        (variant) => {
            const baseMetadata = deps.mediaQualityMetadataResolver(
                variant,
                renditions
            )

            // Determine which content types this variant carries.
            const codecs = variant.codecs?.split(',') ?? []
            const contentTypes = new Set(
                codecs
                    .map((c) => codecToContentType(c))
                    .filter((t): t is ContentType => t != null)
            )
            // If no codecs, default to audio (e.g. TS streams).
            if (contentTypes.size === 0) contentTypes.add('audio')

            // Create one quality per content type, with narrowed mimeType.
            return [...contentTypes].map((contentType) => {
                const codec =
                    codecs.find((c) => codecToContentType(c) === contentType) ??
                    null
                const metadata: MediaQualityMetadata = {
                    ...baseMetadata,
                    contentType,
                    mimeType: contentTypeToMimeType(contentType, codec),
                    codecs: codec,
                }
                const transmuxer = createTransmuxer()

                return {
                    metadata,
                    async getSegment(
                        time: number,
                        affordance = 0
                    ): Promise<SegmentReference<SegmentDataProvider> | null> {
                        // For an audio quality on a variant that also carries video,
                        // the audio is delivered through a separate rendition group
                        // (variant URI is video-only). Use the rendition URI in that
                        // case. Otherwise the variant URI itself contains the audio.
                        let playlistUri = variant.uri
                        if (
                            metadata.contentType === 'audio' &&
                            variant.audioGroup &&
                            contentTypes.has('video')
                        ) {
                            const rendition = renditions.find(
                                (r) =>
                                    r.type === 'AUDIO' &&
                                    r.groupId === variant.audioGroup &&
                                    r.uri
                            )
                            if (rendition?.uri) playlistUri = rendition.uri
                        }
                        const playlist =
                            await data.getMediaPlaylist(playlistUri)
                        const playlistBaseUrl = resolveUrl(playlistUri, baseUrl)
                        const segments = buildSegmentTimeline(
                            deps,
                            playlistBaseUrl,
                            playlist.segments
                        )
                        const segment = getSegmentAtTime(
                            time,
                            segments,
                            affordance
                        )
                        if (!segment) return null

                        // fMP4: use #EXT-X-MAP init segment directly.
                        const hlsMap = playlist.segments[0]?.map
                        if (hlsMap) {
                            return {
                                quality: metadata,
                                ...segment,
                                initData: createSegmentDataProvider(deps, {
                                    url: resolveUrl(
                                        hlsMap.uri,
                                        playlistBaseUrl
                                    ),
                                    mediaRange: hlsMap.byteRange
                                        ? hlsByteRangeToMediaRange(
                                              hlsMap.byteRange
                                          )
                                        : undefined,
                                    reportDownlinkMetrics: false,
                                }),
                            }
                        }

                        // MPEG-TS/ADTS: transmux to fMP4.
                        const transmuxedQuality: MediaQualityMetadata = {
                            ...metadata,
                            mimeType: contentTypeToMimeType(
                                metadata.contentType!,
                                metadata.codecs
                            ),
                        }
                        const rawDataProvider = segment.data
                        return {
                            quality: transmuxedQuality,
                            ...segment,
                            data: async (abort) => {
                                const raw = await rawDataProvider(abort)
                                return transmuxer.transmux(raw).mediaSegment
                            },
                            initData: async (abort) => {
                                const raw = await rawDataProvider(abort)
                                return transmuxer.transmux(raw).initSegment
                            },
                        }
                    },
                } satisfies MediaQualityData
            })
        }
    )

    const period: MediaPeriod = {
        startTime: 0,
        endTime: Infinity,
        qualities,
    }

    let cachedDuration: number | null = null

    return {
        periods: [period],
        minBufferTime: DEFAULT_MIN_BUFFER_TIME,
        async getDuration() {
            if (cachedDuration != null) return cachedDuration
            if (mainPlaylist.variants.length === 0) return null
            try {
                const playlist = await data.getMediaPlaylist(
                    mainPlaylist.variants[0].uri
                )
                let total = 0
                for (const seg of playlist.segments) total += seg.duration
                cachedDuration = total > 0 ? total : null
            } catch {
                return null
            }
            return cachedDuration
        },
    }
}
