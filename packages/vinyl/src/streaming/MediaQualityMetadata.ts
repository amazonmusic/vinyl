/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createShortUid,
    type Maybe,
    type MutableDeep,
} from '@amazon/vinyl-util'
import type { ObjectSchema } from '@amazon/vinyl-validation'
import {
    array,
    enumOf,
    isOneOf,
    number,
    object,
    string,
    tuple,
} from '@amazon/vinyl-validation'
import {
    type DescriptorRecord,
    descriptorRecordValidator,
    descriptorValidator,
} from '@/streaming/DescriptorRecord'

import type { DrmInitDataType } from '@/streaming/DrmInitDataType'
import type { CencEncryptionScheme } from '@/drm/CencEncryptionScheme'
import { DrmKeySystem } from '@/drm/DrmKeySystem'
import type { FrameRate } from '@amazon/vinyl-mpd-parser'

export type ContentType = 'audio' | 'video' | 'text'

export const ALL_CONTENT_TYPES = [
    'video',
    'audio',
    'text',
] as const satisfies ContentType[]

/**
 * Contains media formatting and encryption metadata.
 */
export interface MediaFormatMetadata {
    /**
     * The content type of the representation, e.g. 'audio', 'video', 'text'
     * Must be non-null for segmented media.
     */
    readonly contentType: ContentType | null

    /**
     * The full MIME type of the media.
     *
     * Must be non-null for segmented media.
     */
    readonly mimeType: string | null

    /**
     * The initialization data format.
     */
    readonly initDataType: DrmInitDataType | null

    /**
     * The method of encryption, or null.
     */
    readonly encryptionScheme: CencEncryptionScheme | null

    /**
     * Protection schemes used in this media.
     */
    readonly contentProtections: readonly DrmProtection[]
}

/**
 * Protection information for a key system.
 * Media may have more than one protection system.
 */
export interface DrmProtection {
    /**
     * The key system used in the encryption.
     */
    readonly keySystem: DrmKeySystem

    /**
     * The initialization key, in base 64.
     */
    readonly pssh?: Maybe<string>

    /**
     * PlayReady object.
     */
    readonly pro?: Maybe<string>
}

export const drmProtectionValidator: ObjectSchema<DrmProtection> =
    descriptorValidator.extend({
        keySystem: enumOf(DrmKeySystem),
        pro: string().maybe().optional(),
        pssh: string().maybe().optional(),
    })

export const mediaFormatMetadataValidator: ObjectSchema<MediaFormatMetadata> =
    object({
        contentProtections: array(drmProtectionValidator).readonly(),
        contentType: isOneOf('audio', 'video', 'text').orNull(),
        initDataType: string().orNull(),
        encryptionScheme: string().orNull(),
        mimeType: string().orNull(),
    })

/**
 * Metadata representing attributes of a media representation.
 */
export interface MediaQualityMetadata extends MediaFormatMetadata {
    /**
     * Provides a decoding identifier. If this value changes from the previously buffered
     * segment, the initialization segment must be buffered before appending the media segment.
     * Unique to the track.
     */
    readonly decoderId: string

    /**
     * The quality id identifies the quality representation.
     * Unique to the track.
     */
    readonly qualityId: string

    /**
     * Optional string specifying the codec(s) used for this representation. The format follows the RFC 6381 codec
     * string format.
     */
    readonly codecs: string | null

    /**
     * The average bandwidth in bits per second required for playing this representation.
     * For HLS, and non-segmented media this will be null.
     */
    readonly bandwidth: number | null

    /**
     * The peak bandwidth in bits per second required for playing this representation
     * with its cumulative A/V content streams.
     *
     * Guaranteed to be set for segmented media.
     */
    readonly bandwidthTotal: number | null

    /**
     * Audio sampling rate(s) in samples per second.
     * An array of either one or two decimal integer values. If there are two elements this represents a minimum and
     * maximum sampling rate of the audio media.
     */
    readonly audioSamplingRate: readonly number[] | null

    /**
     * Frame rate for video representations, specified either as a ratio of integers, e.g. [30000, 1001]
     */
    readonly frameRate: FrameRate | null

    /**
     * For video representations, the width of the video in pixels.
     */
    readonly width: number | null

    /**
     * For video representations, the height of the video in pixels.
     */
    readonly height: number | null

    /**
     * Information that may enhance playback or presentation.
     */
    readonly supplementalProperties: DescriptorRecord

    /**
     * Specifies the language of the content, using a code as defined by RFC 5646.
     */
    readonly lang: string | null

    /**
     * Identifies the group this quality belongs to (e.g. the adaptation set).
     */
    readonly groupId: string

    /**
     * The group IDs that this quality is permitted to switch to during playback.
     * Derived from the DASH `urn:mpeg:dash:adaptation-set-switching:2016` supplemental property.
     * Includes the quality's own groupId.
     * Null means no switching constraint (all groups are permitted).
     * An array restricts switching to only the listed group IDs.
     * Default behavior:
     * - DASH: restricted to own group unless adaptation-set-switching property is present.
     * - HLS: restricted to variants with the same base codec and language.
     */
    readonly switchingGroupIds: readonly string[] | null
}

/**
 * Creates a new, empty media format metadata object.
 */
export function createEmptyMediaFormatMetadata(): MutableDeep<MediaFormatMetadata> {
    return {
        contentType: null,
        mimeType: null,
        initDataType: null,
        encryptionScheme: null,
        contentProtections: [],
    }
}

/**
 * Creates a new empty media quality metadata object.
 */
export function createEmptyMediaQualityMetadata(): MutableDeep<MediaQualityMetadata> {
    return {
        ...createEmptyMediaFormatMetadata(),
        decoderId: createShortUid(),
        qualityId: createShortUid(),
        codecs: null,
        bandwidth: null,
        bandwidthTotal: null,
        supplementalProperties: {},
        audioSamplingRate: null,
        frameRate: null,
        height: null,
        width: null,
        lang: null,
        groupId: createShortUid(),
        switchingGroupIds: null,
    }
}

export const mediaQualityMetadataValidator: ObjectSchema<MediaQualityMetadata> =
    mediaFormatMetadataValidator.extend({
        audioSamplingRate: array(number()).readonly().orNull(),
        bandwidth: number().orNull(),
        bandwidthTotal: number().orNull(),
        codecs: string().orNull(),
        decoderId: string(),
        frameRate: tuple(number(), number()).readonly().orNull(),
        height: number().orNull(),
        qualityId: string(),
        supplementalProperties: descriptorRecordValidator,
        width: number().orNull(),
        lang: string().orNull(),
        groupId: string(),
        switchingGroupIds: array(string()).readonly().orNull(),
    })
