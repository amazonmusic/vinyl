/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObjectSchema } from '@amazon/vinyl-validation'
import { boolean, isOneOf, number, object } from '@amazon/vinyl-validation'

/**
 * Layout style applied to each rendered WebVTT cue, mirroring the settable
 * positioning properties of the DOM `VTTCue`. Only the properties that are set
 * are applied; the rest keep the browser defaults.
 *
 * These are the WebVTT cue-box layout controls (not text color/font, which are
 * only reachable via the non-configurable `::cue` pseudo-element). See
 * {@link https://developer.mozilla.org/docs/Web/API/VTTCue}.
 */
export interface VttCueStyle {
    /** Text alignment within the cue box. */
    readonly align?: AlignSetting
    /** Line (vertical) position, as a line number/percentage or `'auto'`. */
    readonly line?: number | AutoKeyword
    /** How `line` is anchored. */
    readonly lineAlign?: LineAlignSetting
    /** Inline position of the cue box, as a percentage or `'auto'`. */
    readonly position?: number | AutoKeyword
    /** How `position` is anchored. */
    readonly positionAlign?: PositionAlignSetting
    /** Size of the cue box as a percentage of the video dimension. */
    readonly size?: number
    /** Whether `line` is a line number (true) or a percentage (false). */
    readonly snapToLines?: boolean
    /** Writing direction. */
    readonly vertical?: DirectionSetting
}

/**
 * Type guard for a DOM cue that is a `VTTCue` (and so carries the WebVTT layout
 * properties). On platforms without `VTTCue`, cues are plain `TextTrackCue`s
 * that cannot be styled.
 */
export function isVttCue(cue: TextTrackCue): cue is VTTCue {
    return typeof VTTCue !== 'undefined' && cue instanceof VTTCue
}

/**
 * Applies the configured layout style to a `VTTCue`, setting only the
 * properties present in `style`.
 */
export function applyVttCueStyle(cue: VTTCue, style: VttCueStyle): void {
    if (style.align !== undefined) cue.align = style.align
    if (style.line !== undefined) cue.line = style.line
    if (style.lineAlign !== undefined) cue.lineAlign = style.lineAlign
    if (style.position !== undefined) cue.position = style.position
    if (style.positionAlign !== undefined)
        cue.positionAlign = style.positionAlign
    if (style.size !== undefined) cue.size = style.size
    if (style.snapToLines !== undefined) cue.snapToLines = style.snapToLines
    if (style.vertical !== undefined) cue.vertical = style.vertical
}

export const vttCueStyleValidator: ObjectSchema<VttCueStyle> = object({
    align: isOneOf('start', 'center', 'end', 'left', 'right').optional(),
    line: number().or(isOneOf('auto')).optional(),
    lineAlign: isOneOf('start', 'center', 'end').optional(),
    position: number().or(isOneOf('auto')).optional(),
    positionAlign: isOneOf(
        'line-left',
        'center',
        'line-right',
        'auto'
    ).optional(),
    size: number().optional(),
    snapToLines: boolean().optional(),
    vertical: isOneOf('', 'rl', 'lr').optional(),
})
