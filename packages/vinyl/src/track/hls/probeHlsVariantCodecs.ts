/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VariantStream } from '@amazon/vinyl-hls-parser'
import { createTransmuxer } from '@amazon/vinyl-transmux'
import {
    logWarn,
    type Maybe,
    type ReadonlyAbort,
    resolveUrl,
} from '@amazon/vinyl-util'
import {
    createSegmentDataProvider,
    type CreateSegmentDataProviderDeps,
} from '../createSegmentDataProvider'
import type { HlsManifestData } from './HlsManifestData'
import type { HlsManifestProvider } from './createHlsManifestProvider'

/**
 * The bytes of a variant's first segment fetched to read its codecs: enough
 * MPEG-TS packets (188 bytes each) for the PAT, PMT, the first video access
 * unit's SPS and several ADTS frames.
 */
export const CODEC_PROBE_BYTES = 188 * 512

const logTarget = { logPrefix: 'HlsCodecProbe' }

/**
 * Wraps an HLS manifest provider so variants without a `CODECS` attribute get
 * one, read from the start of their first MPEG-TS or ADTS segment.
 *
 * Content types and SourceBuffer MIME types come from `CODECS`. Without it, a
 * variant (e.g. a bare media playlist, or a multivariant playlist that omits
 * the attribute) would be assumed audio-only, dropping the video of muxed TS.
 * Variants whose codecs can't be read (fMP4, encrypted, or a failed request)
 * are left unchanged.
 */
export function withProbedHlsCodecs(
    deps: CreateSegmentDataProviderDeps,
    provider: HlsManifestProvider
): HlsManifestProvider {
    return async (abort?: ReadonlyAbort): Promise<HlsManifestData> => {
        const data = await provider(abort)
        const { variants } = data.mainPlaylist
        if (variants.every((v) => v.codecs)) return data
        const probed = await Promise.all(
            variants.map((variant) =>
                variant.codecs
                    ? Promise.resolve(variant)
                    : probeVariantCodecs(deps, data, variant, abort)
            )
        )
        return {
            ...data,
            mainPlaylist: { ...data.mainPlaylist, variants: probed },
        }
    }
}

async function probeVariantCodecs(
    deps: CreateSegmentDataProviderDeps,
    data: HlsManifestData,
    variant: VariantStream,
    abort: Maybe<ReadonlyAbort>
): Promise<VariantStream> {
    try {
        const playlist = await data.getMediaPlaylist(variant.uri)
        if (!playlist.segments.length) return variant
        const segment = playlist.segments[0]
        // fMP4 declares its tracks in the EXT-X-MAP init segment, and encrypted
        // TS can't be read without its key.
        if (segment.map) return variant
        if (segment.key && segment.key.method !== 'NONE') return variant
        const playlistBaseUrl =
            playlist.baseUrl ?? resolveUrl(variant.uri, data.baseUrl)
        const start = segment.byteRange?.offset ?? 0
        const end =
            start +
            Math.min(
                segment.byteRange?.length ?? CODEC_PROBE_BYTES,
                CODEC_PROBE_BYTES
            ) -
            1
        const bytes = await createSegmentDataProvider(deps, {
            url: resolveUrl(segment.uri, playlistBaseUrl),
            mediaRange: [start, end],
            reportDownlinkMetrics: false,
        })(abort)
        // A server that ignores the Range header returns the whole segment;
        // its first probe bytes are enough to read the codecs. The transmuxer
        // throws if it finds no audio or video track.
        const { codecs } = createTransmuxer().transmux(
            bytes.slice(0, CODEC_PROBE_BYTES)
        )
        return { ...variant, codecs: codecs.join(',') }
    } catch (error) {
        if (abort?.aborted()) throw error
        logWarn(
            logTarget,
            'unable to read codecs for variant',
            variant.uri,
            error
        )
        return variant
    }
}
