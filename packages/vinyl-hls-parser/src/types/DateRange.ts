/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The CLASS value that identifies an {@link DateRange} as an HLS Interstitial,
 * the server-guided ad insertion (SGAI) primitive defined by Apple.
 *
 * @see https://developer.apple.com/streaming/GettingStartedWithHLSInterstitials.pdf
 */
export const HLS_INTERSTITIAL_CLASS = 'com.apple.hls.interstitial'

/**
 * A parsed EXT-X-DATERANGE tag from an HLS Media Playlist (RFC 8216 §4.3.2.7).
 *
 * A Date Range associates a span of the media timeline, anchored to a wall-clock
 * START-DATE, with a set of application-defined attributes. It is the transport
 * for HLS Interstitials (SGAI): an interstitial is a Date Range whose
 * {@link classId} is {@link HLS_INTERSTITIAL_CLASS} and which carries the
 * `X-ASSET-URI` or `X-ASSET-LIST` client attributes describing the ad content.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.7
 */
export interface DateRange {
    /** A unique identifier for this Date Range within the playlist (ID). */
    readonly id: string

    /** The `CLASS` attribute, a client-defined category for the range, if present. */
    readonly classId?: string

    /** The ISO-8601 wall-clock time at which the range begins (START-DATE). */
    readonly startDate: string

    /** The ISO-8601 wall-clock time at which the range ends (END-DATE), if present. */
    readonly endDate?: string

    /** The duration of the range in seconds (DURATION), if present. */
    readonly duration?: number

    /** The expected duration of a still-open range in seconds (PLANNED-DURATION), if present. */
    readonly plannedDuration?: number

    /**
     * Whether the END-DATE of a live range equals the START-DATE of the
     * range that follows it (END-ON-NEXT=YES). Ranges with this flag must
     * carry a {@link classId} and omit {@link duration} and {@link endDate}.
     */
    readonly endOnNext?: boolean

    /**
     * The client-defined `X-` attributes of the range, keyed by their full
     * attribute name (e.g. `X-ASSET-URI`). Values are the raw parsed strings
     * with surrounding quotes removed. Numeric and hex `X-` attributes are
     * kept verbatim so callers can interpret them per their own schema.
     */
    readonly clientAttributes: Readonly<Record<string, string>>
}
