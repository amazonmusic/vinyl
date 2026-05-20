/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export type CrossOrigin = 'use-credentials' | 'anonymous' | null

export interface PlaybackSource {
    /**
     * The CORS setting for the media element.
     */
    crossOrigin: CrossOrigin

    /**
     * Contains the absolute URL of the chosen media resource
     * The value is an empty string if the networkState property is EMPTY.
     */
    readonly currentSrc: string

    /**
     * The media element's src.
     */
    src: string | null

    /**
     * The media element's srcObject.
     *
     * Note: while the specification is that srcObject may be MediaStream | MediaSource | Blob,
     * only Safari supports this. Most browsers only support MediaStream.
     */
    srcObject: MediaStream | null

    /**
     * Resets the media element to its initial state and begins the process of selecting a
     * media source and loading the media in preparation for playback to begin at the beginning.
     */
    load(): void

    /**
     * Determines whether the media element is allowed to have a remote playback UI.
     * (Note: AirPlay does not support remote playback for Dash)
     */
    disableRemotePlayback: boolean
}
