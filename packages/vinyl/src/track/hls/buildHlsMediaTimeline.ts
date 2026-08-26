/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsManifestData } from './HlsManifestData'
import type { HlsMediaQualityMetadataResolver } from './HlsMediaQualityMetadataResolver'
import type {
    ContentType,
    MediaQualityMetadata,
} from '../../streaming/MediaQualityMetadata'
import type {
    MediaPeriod,
    MediaQualityData,
    MediaTimeline,
} from '../../streaming/MediaTimeline'
import type { SegmentReference } from '../../streaming/SegmentReference'
import type { SegmentDataProvider } from '../../streaming/SegmentDataSlot'
import { buildSegmentTimeline } from './util/hlsSegmentTime'
import { getSegmentAtTime } from '../../streaming/util/segment'
import { resolveUrl } from '@amazon/vinyl-util'
import { codecToContentType, contentTypeToMimeType } from '../mse/codec'
import {
    createSegmentDataProvider,
    type CreateSegmentDataProviderDeps,
} from '../createSegmentDataProvider'
import { hlsByteRangeToMediaRange } from './util/hlsByteRangeToMediaRange'
import { createTransmuxer } from '@amazon/vinyl-transmux'
import type { AdBreakList } from '../../ad/AdBreakInfo'
import { discoverHlsInterstitials } from '../../ad/discoverHlsInterstitials'

export interface BuildHlsMediaTimelineDeps extends CreateSegmentDataProviderDeps {
    readonly mediaQualityMetadataResolver: HlsMediaQualityMetadataResolver
}

/**
 * Builds a MediaTimeline from an HLS manifest.
 * HLS has a single implicit period spanning the full duration.
 *
 * Audio is modeled per source: a variant that carries muxed audio (no separate
 * AUDIO rendition group) contributes an audio quality on its own playlist, while
 * a variant with a demuxed audio group contributes video only — one audio
 * quality is created per AUDIO rendition in the group, each carrying that
 * rendition's language and playlist. Modeling every language as its own audio
 * quality is what lets the timeline's language filter select among them.
 */
export function buildHlsMediaTimeline(
    deps: BuildHlsMediaTimelineDeps,
    data: HlsManifestData
): MediaTimeline {
    const { mainPlaylist, baseUrl } = data
    const renditions = mainPlaylist.alternativeRenditions
    const audioRenditions = renditions.filter((r) => r.type === 'AUDIO')

    // HLS duration requires fetching a media playlist, so compute it lazily.
    const DEFAULT_MIN_BUFFER_TIME = 10

    const qualities: MediaQualityData[] = []

    for (const variant of mainPlaylist.variants) {
        const baseMetadata = deps.mediaQualityMetadataResolver(
            variant,
            renditions
        )
        const codecs = variant.codecs?.split(',') ?? []
        const contentTypes = new Set(
            codecs
                .map((c) => codecToContentType(c))
                .filter((t): t is ContentType => t != null)
        )
        // If no codecs, default to audio (e.g. TS streams).
        if (contentTypes.size === 0) contentTypes.add('audio')

        const hasDemuxedAudio =
            variant.audioGroup != null &&
            audioRenditions.some(
                (r) => r.groupId === variant.audioGroup && r.uri != null
            )

        // One quality per content type this variant delivers itself.
        for (const contentType of contentTypes) {
            // Demuxed audio is delivered by its rendition group (built below as
            // one quality per language), not by the video variant's playlist.
            if (contentType === 'audio' && hasDemuxedAudio) continue
            const codec =
                codecs.find((c) => codecToContentType(c) === contentType) ??
                null
            qualities.push(
                createHlsQualityData(deps, data, baseUrl, variant.uri, {
                    ...baseMetadata,
                    contentType,
                    mimeType: contentTypeToMimeType(contentType, codec),
                    codecs: codec,
                })
            )
        }
    }

    // One audio quality per demuxed audio rendition (per language), so the
    // media-timeline language filter can select among them.
    const seenAudio = new Set<string>()
    for (const rendition of audioRenditions) {
        const uri = rendition.uri
        if (uri == null || seenAudio.has(uri)) continue
        seenAudio.add(uri)
        // Prefer the variant whose own playlist IS this rendition: its CODECS
        // then describes this exact audio, the only reliable per-rendition codec
        // for a mixed-codec group (one group referenced by variants of differing
        // codecs). Fall back to any variant referencing the group for the common
        // demuxed case where the variant playlist is video and every group
        // variant shares one audio codec.
        const variant =
            mainPlaylist.variants.find((v) => v.uri === uri) ??
            mainPlaylist.variants.find(
                (v) => v.audioGroup === rendition.groupId
            )
        // A rendition neither self-described by a variant nor referenced by one
        // has no codec to play with.
        if (!variant) continue
        const audioCodec =
            variant.codecs
                ?.split(',')
                .find((c) => codecToContentType(c) === 'audio') ?? null
        const baseMetadata = deps.mediaQualityMetadataResolver(
            variant,
            renditions
        )
        // Disambiguate renditions that share a group and language (e.g. a main
        // and an audio-description track) by their unique NAME, so their
        // qualityIds don't collide.
        const qualitySuffix = rendition.language
            ? `${rendition.language}-${rendition.name}`
            : rendition.name
        qualities.push(
            createHlsQualityData(deps, data, baseUrl, uri, {
                ...baseMetadata,
                qualityId: `audio-${rendition.groupId}-${qualitySuffix}`,
                decoderId: uri,
                contentType: 'audio',
                codecs: audioCodec,
                mimeType: contentTypeToMimeType('audio', audioCodec),
                width: null,
                height: null,
                frameRate: null,
                lang: rendition.language ?? null,
                characteristics: rendition.characteristics ?? [],
            })
        )
    }

    const period: MediaPeriod = {
        startTime: 0,
        endTime: Infinity,
        qualities,
    }

    let cachedDuration: number | null = null

    return {
        periods: [period],
        minBufferTime: DEFAULT_MIN_BUFFER_TIME,
        getAdBreaks: () => discoverAdsFromManifest(data),
        async getDuration() {
            if (cachedDuration != null) return cachedDuration
            if (mainPlaylist.variants.length === 0) {
                throw new Error('Unable to determine HLS duration: no variants')
            }
            const playlist = await data.getMediaPlaylist(
                mainPlaylist.variants[0].uri
            )
            // Live playlists (no EXT-X-ENDLIST) have unbounded duration.
            if (!playlist.ended) return Infinity
            if (playlist.segments.length === 0) {
                throw new Error(
                    'Unable to determine HLS duration: no segments in media playlist'
                )
            }
            let total = 0
            for (const seg of playlist.segments) total += seg.duration
            cachedDuration = total
            return cachedDuration
        },
    }
}

/**
 * Builds the {@link MediaQualityData} for one HLS quality: its metadata plus a
 * getSegment that fetches from `playlistUri` (the variant playlist for video/
 * muxed qualities, or a rendition playlist for demuxed audio) and either serves
 * fMP4 directly (using its EXT-X-MAP init segment) or transmuxes MPEG-TS/ADTS.
 */
function createHlsQualityData(
    deps: BuildHlsMediaTimelineDeps,
    data: HlsManifestData,
    baseUrl: string,
    playlistUri: string,
    metadata: MediaQualityMetadata
): MediaQualityData {
    const transmuxer = createTransmuxer()
    return {
        metadata,
        async getSegment(
            time: number,
            affordance = 0
        ): Promise<SegmentReference<SegmentDataProvider> | null> {
            const playlist = await data.getMediaPlaylist(playlistUri)
            const playlistBaseUrl = resolveUrl(playlistUri, baseUrl)
            const segments = buildSegmentTimeline(
                deps,
                playlistBaseUrl,
                playlist.segments
            )
            const segment = getSegmentAtTime(time, segments, affordance)
            if (!segment) return null

            // fMP4: use #EXT-X-MAP init segment directly.
            const hlsMap = playlist.segments[0]?.map
            if (hlsMap) {
                return {
                    quality: metadata,
                    ...segment,
                    initData: createSegmentDataProvider(deps, {
                        url: resolveUrl(hlsMap.uri, playlistBaseUrl),
                        mediaRange: hlsMap.byteRange
                            ? hlsByteRangeToMediaRange(hlsMap.byteRange)
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
}

async function discoverAdsFromManifest(
    data: HlsManifestData
): Promise<AdBreakList> {
    if (data.mainPlaylist.variants.length === 0) return []
    // Use the first variant for the date range timeline
    // https://gist.github.com/bkataru/1fb67181ddf0edfc60c04f6f02518e74?utm_source=chatgpt.com#file-hls-specification-txt-L3449
    const variant = data.mainPlaylist.variants[0]
    const media = await data.getMediaPlaylist(variant.uri)
    const contentDuration = media.ended
        ? media.segments.reduce((sum, s) => sum + s.duration, 0)
        : null
    const playlistBaseUrl = resolveUrl(variant.uri, data.baseUrl)
    return discoverHlsInterstitials(media, playlistBaseUrl, contentDuration)
}
