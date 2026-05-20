/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorOrigin,
    type ExtractValues,
    getOrSet,
    getOrSetProp,
    memoize,
    type MutableDeep,
    sortedInsertionIndex,
    ValidationError,
} from '@amazon/vinyl-util'
import {
    type AdaptationSetType,
    type ContentProtection,
    ContentProtectionScheme,
    type DescriptorType,
    type PeriodType,
    type RepresentationBaseType,
    type RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import type {
    ContentType,
    DrmProtection,
    MediaQualityMetadata,
} from '@/streaming/MediaQualityMetadata'
import { type DrmKeySystemResolver } from '@/drm/DrmKeySystemResolver'
import { getRepresentationMimeInfo } from '@/track/dash/util/mimeType'
import type { DescriptorRecord } from '@/streaming/DescriptorRecord'
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'
import {
    type CencEncryptionScheme,
    parseCencEncryptionScheme,
} from '@/drm/CencEncryptionScheme'

/**
 * DASH supplemental property scheme URI for adaptation set switching.
 * @see https://dashif.org/docs/DASH-IF-IOP-v4.3.pdf Section 3.8
 */
export const ADAPTATION_SET_SWITCHING_SCHEME =
    'urn:mpeg:dash:adaptation-set-switching:2016'

/**
 * Creates abstract MediaQualityMetadata from a Dash Representation.
 */
export type DashMediaQualityMetadataResolver = (
    representation: RepresentationType
) => MediaQualityMetadata

/**
 * Returns a dash metadata resolver that calculates media encoding metadata from the representation.
 * The most recently used representations will return cached results.
 */
export function createDefaultDashMediaQualityMetadataResolver(
    deps: DashMediaQualityMetadataResolverDeps
): DashMediaQualityMetadataResolver {
    return memoize(
        (representation) =>
            createMediaQualityMetadataFromDashRepresentation(
                representation,
                deps
            ),
        (representation) => representation,
        30
    )
}

export interface DashMediaQualityMetadataResolverDeps {
    readonly drmKeySystemResolver: DrmKeySystemResolver
}

export function createMediaQualityMetadataFromDashRepresentation(
    representation: RepresentationType,
    deps: DashMediaQualityMetadataResolverDeps
): MediaQualityMetadata {
    const { contentType, mimeType } = getRepresentationMimeInfo(representation)
    if (!contentType || !mimeType)
        throw new ValidationError(
            'mimeType cannot be inferred',
            ErrorOrigin.MEDIA
        )
    const adaptationSet = representation.parent
    const period = adaptationSet.parent
    const mpd = period.parent

    const periodId = period.id ?? `$${mpd.Period.indexOf(period)}`
    const adaptationSetId =
        adaptationSet.id ?? `$${period.AdaptationSet!.indexOf(adaptationSet)}`
    const qualityId = `${periodId}_${adaptationSetId}_${representation.id}`
    // Representations within the same adaptation set where bitstreamSwitching is true can be changed without
    // reinitializing the decoder.
    let decoderId = `${periodId}_${adaptationSetId}`
    const bitstreamSwitching =
        adaptationSet.bitstreamSwitching ?? period.bitstreamSwitching
    if (!bitstreamSwitching) decoderId += `_${representation.id}`

    // Resolve the adaptation set switching group. Adaptation sets that declare
    // urn:mpeg:dash:adaptation-set-switching:2016 with each other's IDs form a switching group,
    // meaning their representations are permitted to switch between each other.
    const groupId = `${periodId}_${adaptationSetId}`
    const switchingGroupIds = resolveAdaptationSetSwitchingGroupIds(
        adaptationSet,
        periodId,
        adaptationSetId
    )

    // Pick a representation base property which may be inherited from the adaptation set.
    function pick<K extends keyof RepresentationBaseType>(
        key: K
    ): NonNullable<RepresentationBaseType[K]> | null {
        return representation[key] ?? adaptationSet[key] ?? null
    }

    // Combines the descriptors for the given key into a map of scheme URI to Descriptor lists.
    type DescriptorProps = keyof ExtractValues<
        Required<RepresentationBaseType>,
        readonly DescriptorType[]
    >
    function mergeDescriptors(key: DescriptorProps): DescriptorRecord {
        const arr1 = adaptationSet[key] ?? []
        const arr2 = representation[key] ?? []
        return mapDescriptors([...arr1, ...arr2])
    }

    const contentProtections = [
        ...(adaptationSet.ContentProtection ?? []),
        ...(representation.ContentProtection ?? []),
    ]

    // Get the encryption scheme from the parsed CENC ContentProtection value.
    let initDataType: DrmInitDataType | null = null
    let encryptionScheme: CencEncryptionScheme | null = null
    for (let i = contentProtections.length - 1; i >= 0; i--) {
        const cP = contentProtections[i]
        if (cP.schemeIdUri === ContentProtectionScheme.CENC) {
            initDataType = 'cenc'
            encryptionScheme =
                parseCencEncryptionScheme(cP.value)?.scheme ?? null
            break
        }
    }

    return {
        qualityId,
        decoderId,
        groupId,
        switchingGroupIds,
        mimeType,
        contentType,
        codecs: pick('codecs'),
        bandwidth: representation.bandwidth,
        bandwidthTotal: estimatePeakBandwidth(representation, contentType),
        audioSamplingRate: pick('audioSamplingRate'),
        frameRate: pick('frameRate'),
        width: pick('width'),
        height: pick('height'),
        lang: adaptationSet.lang ?? null,
        contentProtections: contentProtections.flatMap((cP) =>
            contentProtectionToMetadata(cP, deps)
        ),
        encryptionScheme,
        initDataType,
        supplementalProperties: mergeDescriptors('SupplementalProperty'),
    }
}

/**
 * Estimates the total bandwidth a representation would use when paired with
 * proportionally matched qualities from sibling content types.
 *
 * For each sibling content type, the representation's relative position within its own
 * content type's sorted bandwidth list is mapped to the corresponding position in the
 * sibling's list. This produces realistic pairings — e.g. with video [v1,v2,v3,v4] and
 * audio [a1,a2], v1 pairs with a1, v2 with a1, v3 with a2, v4 with a2.
 */
export function estimatePeakBandwidth(
    representation: RepresentationType,
    contentType: ContentType
): number {
    const sortedByType = getPeriodSortedBandwidths(representation.parent.parent)
    const own = sortedByType.get(contentType)
    if (!own || own.length === 0) return representation.bandwidth
    // Find the closest match in the descending-sorted array. indexOf would return -1
    // when the representation's bandwidth was collapsed by the 10% dedup threshold.
    const ownIndex = Math.max(
        0,
        sortedInsertionIndex(own, representation.bandwidth, (a, b) => b - a) - 1
    )
    const position = own.length <= 1 ? 0 : ownIndex / (own.length - 1)
    let total = representation.bandwidth
    for (const [ct, bandwidths] of sortedByType) {
        if (ct === contentType) continue
        const peerIndex = Math.min(
            Math.round(position * (bandwidths.length - 1)),
            bandwidths.length - 1
        )
        total += bandwidths[peerIndex]
    }
    return total
}

/**
 * Returns sorted (descending) bandwidth arrays per content type for a period.
 * Bandwidths within 10% of an existing entry are collapsed to reduce noise
 * from near-duplicate quality tiers.
 * Cached by period reference.
 */
export const getPeriodSortedBandwidths = memoize(
    (period: PeriodType): ReadonlyMap<ContentType, readonly number[]> => {
        const byType = new Map<ContentType, number[]>()
        for (const as of period.AdaptationSet ?? []) {
            for (const rep of as.Representation ?? []) {
                const contentType = getRepresentationMimeInfo(rep).contentType
                if (!contentType) continue
                const arr = getOrSet(byType, contentType, () => [])
                if (
                    !arr.some(
                        (existing) =>
                            Math.abs(existing - rep.bandwidth) / existing < 0.1
                    )
                ) {
                    const index = sortedInsertionIndex(
                        arr,
                        rep.bandwidth,
                        (a, b) => b - a
                    )
                    arr.splice(index, 0, rep.bandwidth)
                }
            }
        }
        return byType
    },
    (period) => period,
    5
)

/**
 * Converts a Dash ContentProtection element to a list of DrmProtection metadata.
 */
export function contentProtectionToMetadata(
    contentProtection: ContentProtection,
    deps: DashMediaQualityMetadataResolverDeps
): readonly DrmProtection[] {
    const keySystems = deps.drmKeySystemResolver(contentProtection.schemeIdUri)
    return keySystems.map((keySystem) => {
        return {
            keySystem,
            pssh: contentProtection.pssh?._content ?? null,
            pro: contentProtection.pro?._content ?? null,
        }
    })
}

/**
 * Creates a DescriptorRecord from the Dash list of DescriptorType objects.
 * @param descriptors
 */
function mapDescriptors(
    descriptors: readonly DescriptorType[]
): DescriptorRecord {
    const out: MutableDeep<DescriptorRecord> = {}
    for (const descriptor of descriptors) {
        const arr = getOrSetProp(out, descriptor.schemeIdUri, () => [])!
        arr.push({
            id: descriptor.id ?? null,
            value: descriptor.value ?? null,
        })
    }
    return out
}

/**
 * Resolves the group IDs that the given adaptation set is permitted to switch to.
 *
 * Per DASH spec, adaptation sets declare `urn:mpeg:dash:adaptation-set-switching:2016` with a
 * comma-separated list of other adaptation set IDs they can switch to.
 *
 * Always includes the adaptation set's own groupId. If no switching property is present,
 * returns only the adaptation set's own groupId.
 */
function resolveAdaptationSetSwitchingGroupIds(
    adaptationSet: AdaptationSetType,
    periodId: string,
    adaptationSetId: string | number
): readonly string[] | null {
    const selfGroupId = `${periodId}_${adaptationSetId}`
    const switchingProp = adaptationSet.SupplementalProperty?.find(
        (p) => p.schemeIdUri === ADAPTATION_SET_SWITCHING_SCHEME
    )
    if (!switchingProp) return [selfGroupId]

    const value = switchingProp.value?.trim()
    if (!value) return [selfGroupId]

    const targetIds = value.split(',').map((s) => s.trim())
    return [selfGroupId, ...targetIds.map((id) => `${periodId}_${id}`)]
}
