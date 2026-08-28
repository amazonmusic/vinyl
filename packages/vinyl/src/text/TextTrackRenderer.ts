/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Renders a text track's cues. Injected into the player so an application can
 * paint captions itself (as HTML) instead of relying on the browser's native
 * `TextTrack` rendering — giving full control over styling and placement.
 *
 * The controller hands the renderer the DOM `TextTrack` (set to `'hidden'`, so
 * the browser tracks cue timing but does not paint); the renderer listens for
 * the track's active cues and draws them. See {@link HtmlTextTrackRenderer} for
 * the built-in HTML implementation.
 */
export interface TextTrackRenderer {
    /**
     * Renders the active cues of `track`, listening for cue changes. Passing
     * `null` clears anything rendered and detaches from the previous track.
     */
    setTextTrack(track: TextTrack | null): void

    /**
     * Supplies the CSS bodies of the track's WebVTT `STYLE` blocks (which carry
     * `::cue` rules), so the renderer can style cue classes. Optional — a
     * renderer may ignore authored styles.
     */
    setStyles?(styles: readonly string[]): void
}
