/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Timestamp } from '@amazon/vinyl-util'
import type { TrackUri } from '../track/Track'
import type { ContentType } from './MediaQualityMetadata'

/**
 * The stage of the track-load journey a {@link LoadSpanMeasurement} describes.
 *
 * - `manifest`: fetching and parsing the DASH/HLS manifest.
 * - `keySetup`: the EME/CDM setup, from session creation to the CDM's first
 *   license message. Precedes and is contiguous with `license`.
 * - `license`: the DRM license request/response exchange.
 * - `initSegment`: fetching the initialization segment.
 * - `firstSegment`: fetching the first media segment.
 */
export type LoadSpanKind =
    'manifest' | 'keySetup' | 'license' | 'initSegment' | 'firstSegment'

/**
 * A timed span for one stage of a track load.
 *
 * Dispatched by the controller that owns the stage. Emitters attribute the span
 * to the track it was measured for at the source (see {@link trackUri}); the
 * player republishes it as a {@link LoadSpanEvent}. When the emitter cannot know
 * the owning track, `trackUri` is omitted and the span is dropped rather than
 * misattributed.
 */
export interface LoadSpanMeasurement {
    readonly kind: LoadSpanKind

    /**
     * When the stage began, as a unix millisecond timestamp.
     */
    readonly startTime: Timestamp

    /**
     * When the stage completed, as a unix millisecond timestamp.
     */
    readonly endTime: Timestamp

    /**
     * The track this span was measured for, stamped at the source by the
     * emitter that knows which track initiated the load. Omitted only when the
     * initiating track is not yet known (e.g. an encrypted event handled before
     * buffering DRM info is set).
     */
    readonly trackUri?: TrackUri

    /**
     * The MIME type of the content this span was measured for, when known. Set
     * for DRM `license` spans so a certificate exchange and the per-content-type
     * license exchanges are distinguishable.
     */
    readonly mimeType?: string

    /**
     * The content type this span was measured for, when known. Set alongside
     * {@link mimeType} for DRM `license` spans.
     */
    readonly contentType?: ContentType
}

/**
 * A {@link LoadSpanMeasurement} attributed to the track it was measured for.
 *
 * Emitted on the player as the `loadSpan` event.
 */
export interface LoadSpanEvent extends LoadSpanMeasurement {
    readonly trackUri: TrackUri
}

/**
 * Player-level load metric events.
 */
export interface LoadMetricEventMap {
    /**
     * A stage of a track load completed. Reports the time span of the stage
     * together with the track it belongs to. Consumers measuring end-to-end
     * load latency key on the first event per `kind` and `trackUri`.
     */
    readonly loadSpan: LoadSpanEvent
}
