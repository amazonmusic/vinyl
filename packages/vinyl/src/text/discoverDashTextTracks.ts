/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashManifest } from '@amazon/vinyl-mpd-parser'
import { resolveUrl } from '@amazon/vinyl-util'
import type { TextTrackInfo } from './TextTrack'

/**
 * Discovers sidecar text tracks from a DASH manifest.
 *
 * Considers an `<AdaptationSet>` to carry text when one of:
 *  - `contentType="text"`
 *  - `mimeType` starts with `text/` (e.g. `text/vtt`)
 *  - `mimeType` is `application/mp4` *and* the codec/role indicates text
 *
 * Within a text adaptation set, each `<Representation>` becomes one
 * {@link TextTrackInfo}. The `BaseURL` chain (MPD → Period → AdaptationSet →
 * Representation) is resolved against the supplied `baseUrl`.
 *
 * Only sidecar (single-file) WebVTT renditions are surfaced. Segmented text
 * tracks (`stpp`/`wvtt` codecs) are ignored - they would require streaming
 * through MSE which the sidecar pipeline does not support.
 *
 * @param manifest The parsed DASH manifest.
 * @param baseUrl The URL of the manifest, used as the root for `BaseURL`
 * resolution.
 */
export function discoverDashTextTracks(
    manifest: DashManifest,
    baseUrl: string
): readonly TextTrackInfo[] {
    const out: TextTrackInfo[] = []

    const periods = manifest.MPD.Period
    const mpdBase = chainBase(baseUrl, manifest.MPD.BaseURL)

    for (let p = 0; p < periods.length; p++) {
        const period = periods[p]
        const periodBase = chainBase(mpdBase, period.BaseURL)
        const adaptationSets = period.AdaptationSet ?? []
        for (const adaptationSet of adaptationSets) {
            if (!isTextAdaptationSet(adaptationSet)) continue
            const asBase = chainBase(periodBase, adaptationSet.BaseURL)
            const representations = adaptationSet.Representation ?? []
            for (const representation of representations) {
                const repBase = chainBase(asBase, representation.BaseURL)
                const uri = pickRepresentationUri(repBase, representation.id)
                const mimeType =
                    representation.mimeType ?? adaptationSet.mimeType ?? null
                // Only surface sidecar formats. Segmented text (stpp/wvtt) is
                // intentionally skipped.
                if (!isSidecarTextMime(mimeType)) continue
                const language = adaptationSet.lang ?? null
                const role = adaptationSet.Role?.find(
                    (d) => d.schemeIdUri === 'urn:mpeg:dash:role:2011'
                )?.value
                const isCaption = role === 'caption'
                const isDefault = role === 'main'
                out.push({
                    id: `dash-text-${p}-${representation.id}`,
                    kind: isCaption ? 'captions' : 'subtitles',
                    language,
                    label: language ?? representation.id,
                    default: isDefault,
                    uri,
                    mimeType,
                })
            }
        }
    }

    return out
}

function isTextAdaptationSet(adaptationSet: {
    readonly contentType?: string
    readonly mimeType?: string
}): boolean {
    if (adaptationSet.contentType === 'text') return true
    const mt = adaptationSet.mimeType
    if (mt && mt.startsWith('text/')) return true
    return false
}

function isSidecarTextMime(mimeType: string | null): boolean {
    // Permissive when manifest omits the MIME type, otherwise require a
    // text/* MIME type. Segmented codec-only types like application/mp4
    // (used with stpp/wvtt codecs) are excluded.
    if (mimeType == null) return true
    return mimeType.startsWith('text/')
}

function chainBase(
    parent: string,
    bases: readonly { readonly _content: string }[] | undefined
): string {
    if (!bases || bases.length === 0) return parent
    return resolveUrl(bases[0]._content, parent)
}

function pickRepresentationUri(base: string, id: string): string {
    // For a sidecar text representation, the BaseURL is expected to point at
    // the file. When the chain ends in a directory (trailing `/`), append a
    // conventional `<id>.vtt` filename so the loader can fetch the resource.
    if (base.endsWith('/')) {
        return resolveUrl(`${id}.vtt`, base)
    }
    return base
}
