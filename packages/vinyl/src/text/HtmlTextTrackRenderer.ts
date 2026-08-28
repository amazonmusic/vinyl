/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@amazon/vinyl-util'
import type { TextTrackRenderer } from './TextTrackRenderer'

/**
 * The subset of a `VTTCue`'s positioning properties {@link computeCueLayout}
 * reads. A native `VTTCue` satisfies this; a plain `TextTrackCue` (platforms
 * without `VTTCue`) leaves them undefined and falls back to defaults.
 */
export interface CueGeometry {
    readonly align?: string | null
    readonly line?: number | AutoKeyword
    readonly lineAlign?: LineAlignSetting
    readonly position?: number | AutoKeyword
    readonly positionAlign?: PositionAlignSetting
    readonly size?: number
    readonly snapToLines?: boolean
    readonly vertical?: DirectionSetting
}

/** Inline styles (camelCase CSS properties) to apply to a rendered cue box. */
export type CueLayout = Record<string, string>

/** Approximate row height for integer (snap-to-lines) `line` offsets. */
const ROW_EM = 1.5

/**
 * Maps a cue's WebVTT positioning settings to inline CSS. Pure and DOM-free so
 * the (branchy) placement logic is unit-testable in isolation.
 *
 * A cue with neither `line` nor `position` set flows in the renderer's
 * bottom-anchored, centered container (the common subtitle case). Otherwise it
 * is absolutely positioned: `size` → width, `position`/`positionAlign` →
 * horizontal, `line`/`lineAlign`/`snapToLines` → vertical (percentage lines, or
 * whole rows counted from the bottom for negative integers), `align` → text
 * alignment, `vertical` → writing mode.
 */
export function computeCueLayout(cue: CueGeometry): CueLayout {
    const style: CueLayout = {}
    // WebVTT's default text alignment is 'center'.
    style.textAlign = cue.align || 'center'
    if (cue.vertical === 'rl') style.writingMode = 'vertical-rl'
    else if (cue.vertical === 'lr') style.writingMode = 'vertical-lr'
    const size = typeof cue.size === 'number' ? cue.size : 100
    style.maxWidth = `${size}%`

    const line = typeof cue.line === 'number' ? cue.line : null
    const position = typeof cue.position === 'number' ? cue.position : null
    if (line == null && position == null) return style

    style.position = 'absolute'
    const transforms: string[] = []

    if (position == null) {
        style.left = '50%'
        transforms.push('translateX(-50%)')
    } else {
        if (cue.positionAlign === 'line-right') {
            style.right = `${100 - position}%`
        } else if (cue.positionAlign === 'line-left') {
            style.left = `${position}%`
        } else {
            style.left = `${position}%`
            transforms.push('translateX(-50%)')
        }
    }

    if (line == null) {
        style.bottom = '0'
    } else {
        if (cue.snapToLines === false) {
            if (cue.lineAlign === 'end') {
                style.bottom = `${100 - line}%`
            } else if (cue.lineAlign === 'center') {
                style.top = `${line}%`
                transforms.push('translateY(-50%)')
            } else {
                style.top = `${line}%`
            }
        } else if (line < 0) {
            style.bottom = `${(-line - 1) * ROW_EM}em`
        } else {
            style.top = `${line * ROW_EM}em`
        }
    }

    if (transforms.length > 0) style.transform = transforms.join(' ')
    return style
}

const HTML_ESCAPE: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
}

/** Escapes text (and attribute values) for safe insertion via innerHTML. */
function escapeHtml(text: string): string {
    // Character class, no backtracking.
    return text.replace(/["&<>]/g, (ch) => HTML_ESCAPE[ch])
}

// WebVTT inline tags rendered as the matching HTML element.
const PASSTHROUGH_TAGS = new Set(['i', 'b', 'u', 'ruby', 'rt'])
// Tags rendered as a <span> (styling/metadata carried via class/attributes).
const SPAN_TAGS = new Set(['c', 'v', 'lang'])

/** Opening HTML for a WebVTT start tag `inner` (the text between `<` and `>`). */
function openTag(inner: string): string {
    // Timestamp tags (`<00:00:00.000>`) carry no styling — drop them.
    if (/^\d/.test(inner)) return ''
    // The head (before any annotation) is `name` plus `.class` segments.
    const head = inner.split(/\s/, 1)[0]
    const [name, ...classes] = head.split('.')
    const annotation = inner.slice(head.length).trim()
    const classAttr = classes.filter(Boolean).length
        ? ` class="${escapeHtml(classes.filter(Boolean).join(' '))}"`
        : ''
    if (PASSTHROUGH_TAGS.has(name)) return `<${name}${classAttr}>`
    if (name === 'v') {
        const title = annotation ? ` title="${escapeHtml(annotation)}"` : ''
        return `<span${classAttr}${title}>`
    }
    if (name === 'lang') {
        const lang = annotation ? ` lang="${escapeHtml(annotation)}"` : ''
        return `<span${classAttr}${lang}>`
    }
    if (name === 'c') return `<span${classAttr}>`
    return '' // unknown tag: drop
}

/** Closing HTML for a WebVTT end tag named `name`. */
function closeTag(name: string): string {
    if (PASSTHROUGH_TAGS.has(name)) return `</${name}>`
    if (SPAN_TAGS.has(name)) return '</span>'
    return ''
}

/**
 * Renders a cue's text payload as safe HTML. Text is escaped (so it can't
 * inject nodes); newlines become `<br>`; and WebVTT cue tags are converted:
 * `<c.foo>`→`<span class="foo">`, `<i>/<b>/<u>/<ruby>/<rt>` pass through,
 * `<v Name>`→`<span title>`, `<lang xx>`→`<span lang>`, timestamp tags are
 * dropped. Class-based styling requires matching app CSS (STYLE blocks in the
 * VTT are not applied).
 */
export function renderCueText(text: string): string {
    let html = ''
    // Each match is one tag (`<…>`), a run of non-`<` text, or a stray `<`.
    // The tag body excludes `<` (as well as `>`) so a failed tag match on a
    // `<`-heavy string bails after one char rather than scanning to the end —
    // keeping this linear (no polynomial backtracking) on adversarial input.
    for (const token of text.match(/<[^<>]*>|[^<]+|</g) ?? []) {
        if (token[0] !== '<' || token === '<') {
            html += escapeHtml(token).replace(/\n/g, '<br>')
        } else {
            const inner = token.slice(1, -1)
            html +=
                inner[0] === '/'
                    ? closeTag(
                          inner.slice(1).split(/[.\s]/, 1)[0].toLowerCase()
                      )
                    : openTag(inner)
        }
    }
    return html
}

/**
 * Rewrites a WebVTT `STYLE` block's `::cue` selectors to target this renderer's
 * HTML cue elements: `::cue(<sel>)` → `.vinyl-text-cue <sel>` (cue components
 * become descendants of the cue box) and bare `::cue` → `.vinyl-text-cue`.
 * Rules are global to `.vinyl-text-cue`, so concurrent players share them.
 */
function scopeCueRules(css: string): string {
    // Bounded character classes; no nested quantifiers, so no backtracking blowup.
    return css
        .replace(/::cue\(([^)]*)\)/g, '.vinyl-text-cue $1')
        .replace(/::cue\b/g, '.vinyl-text-cue')
}

/**
 * A {@link TextTrackRenderer} that paints cues as HTML into {@link element}.
 * Mount `element` over the video; it stacks cues at the bottom, centered, and
 * positions any cue that carries explicit WebVTT settings. The DOM track is
 * expected to be `'hidden'` so only this renderer paints.
 */
export class HtmlTextTrackRenderer implements TextTrackRenderer, Disposable {
    /** The overlay container to mount over the video. */
    readonly element: HTMLElement

    private track: TextTrack | null = null
    // Holds the authored STYLE-block CSS (::cue rules rewritten to target our
    // cue elements). A <style> renders nothing itself, so it lives in-container.
    private readonly styleElement: HTMLStyleElement
    private readonly onCueChange = () => this.renderActiveCues()

    constructor() {
        this.element = document.createElement('div')
        this.element.className = 'vinyl-text-container'
        Object.assign(this.element.style, {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            pointerEvents: 'none',
        })
        this.styleElement = document.createElement('style')
        this.element.appendChild(this.styleElement)
    }

    setTextTrack(track: TextTrack | null): void {
        if (track === this.track) return
        this.track?.removeEventListener('cuechange', this.onCueChange)
        this.track = track
        // Drop the previous track's authored styles; the new one supplies its
        // own via setStyles once loaded.
        this.styleElement.textContent = ''
        if (!track) {
            this.element.replaceChildren(this.styleElement)
            return
        }
        track.addEventListener('cuechange', this.onCueChange)
        this.renderActiveCues()
    }

    setStyles(styles: readonly string[]): void {
        this.styleElement.textContent = styles.map(scopeCueRules).join('\n')
    }

    dispose(): void {
        this.setTextTrack(null)
    }

    private renderActiveCues(): void {
        // Only invoked while a track is attached (from setTextTrack / cuechange).
        const active = this.track!.activeCues ?? []
        // Keep the <style> element; replace only the cue boxes.
        const children: (HTMLElement | HTMLStyleElement)[] = [this.styleElement]
        for (let i = 0; i < active.length; i++) {
            children.push(this.createCueBox(active[i]))
        }
        this.element.replaceChildren(...children)
    }

    private createCueBox(cue: TextTrackCue): HTMLElement {
        const box = document.createElement('div')
        box.className = 'vinyl-text-cue'
        Object.assign(box.style, computeCueLayout(cue as CueGeometry))
        box.innerHTML = renderCueText((cue as { text?: string }).text ?? '')
        return box
    }
}
