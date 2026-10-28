/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * How appended media is positioned on the presentation timeline, matching the
 * MSE `SourceBuffer.mode`.
 *
 * - `'segments'`: media is placed by its own timestamps, offset by a mapping
 *   that is constant for a DASH Representation (`Period@start −
 *   presentationTimeOffset`) or anchored once per continuous run for HLS. Audio
 *   and video stay in sync even when the manifest's segment times are
 *   approximate (e.g. `SegmentList@duration` over variable-length segments).
 * - `'sequence'`: each run of appends starts at the manifest's segment start
 *   time and continues contiguously, ignoring the media timestamps. Approximate
 *   manifest times shift each track by its own error, so audio and video can
 *   drift apart after a seek or quality switch.
 */
export type AppendMode = 'segments' | 'sequence'
