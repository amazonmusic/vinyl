/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A variant stream in an HLS Master Playlist (EXT-X-STREAM-INF).
 *
 * Each variant represents the same presentation at a particular bitrate and resolution,
 * optionally referencing alternative rendition groups for audio, video, subtitles, or closed captions.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.4.2
 */
export interface VariantStream {
    /** The peak bitrate of the variant stream in bits per second (BANDWIDTH). */
    readonly bandwidth: number

    /** The URI of the Media Playlist for this variant. */
    readonly uri: string

    /** A comma-separated list of codec strings describing the media in this variant (CODECS). */
    readonly codecs?: string

    /** The horizontal resolution of the video in pixels (RESOLUTION width). */
    readonly width?: number

    /** The vertical resolution of the video in pixels (RESOLUTION height). */
    readonly height?: number

    /** The maximum frame rate of the video in frames per second (FRAME-RATE). */
    readonly frameRate?: number

    /** The GROUP-ID of the audio alternative renditions to use with this variant (AUDIO). */
    readonly audioGroup?: string

    /** The GROUP-ID of the video alternative renditions to use with this variant (VIDEO). */
    readonly videoGroup?: string

    /** The GROUP-ID of the subtitle alternative renditions to use with this variant (SUBTITLES). */
    readonly subtitlesGroup?: string

    /** The GROUP-ID of the closed-caption alternative renditions to use with this variant (CLOSED-CAPTIONS). */
    readonly closedCaptionsGroup?: string
}
