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
 * Options for {@link HtmlTextTrackRenderer}.
 */
export interface HtmlTextTrackRendererOptions {
    /**
     * The video the captions belong to. When given, the renderer hands painting
     * back to the browser while the video is in picture-in-picture: the PiP
     * window shows only the video and its natively `'showing'` text tracks, so
     * an HTML overlay can't reach it. The track is set `'showing'` on
     * `enterpictureinpicture` and back to `'hidden'` on `leavepictureinpicture`.
     */
    readonly media?: HTMLMediaElement | null

    /**
     * The width, as a percentage of the video's, of the browser-painted cues in
     * picture-in-picture (`VTTCue.size`), so captions clear the PiP window's
     * rounded corners. Applies only to cues without an authored size. Default
     * 90; 100 leaves them full width.
     */
    readonly pictureInPictureCueSize?: number
}

/** The default {@link HtmlTextTrackRendererOptions.pictureInPictureCueSize}. */
const DEFAULT_PIP_CUE_SIZE = 90

/**
 * A {@link TextTrackRenderer} that paints cues as HTML into {@link element}.
 * Mount `element` over the video; it stacks cues at the bottom, centered, and
 * positions any cue that carries explicit WebVTT settings. The DOM track is
 * expected to be `'hidden'` so only this renderer paints (except in
 * picture-in-picture, see {@link HtmlTextTrackRendererOptions.media}).
 */
export class HtmlTextTrackRenderer implements TextTrackRenderer, Disposable {
    /** The overlay container to mount over the video. */
    readonly element: HTMLElement

    private track: TextTrack | null = null
    // Holds the authored STYLE-block CSS (::cue rules rewritten to target our
    // cue elements). A <style> renders nothing itself, so it lives in-container.
    private readonly styleElement: HTMLStyleElement
    private readonly onCueChange = () => {
        if (this.inPip) this.narrowCues()
        this.renderActiveCues()
    }
    private readonly pipCueSize: number
    // Cues narrowed to pipCueSize in picture-in-picture, restored on leaving it.
    private readonly narrowed = new Set<VTTCue>()
    private readonly media: HTMLMediaElement | null
    // Whether `media` is in picture-in-picture, where the browser paints.
    private inPip = false
    private readonly onEnterPip = () => this.setInPip(true)
    private readonly onLeavePip = () => this.setInPip(false)

    constructor(options: HtmlTextTrackRendererOptions = {}) {
        this.media = options.media ?? null
        this.pipCueSize =
            options.pictureInPictureCueSize ?? DEFAULT_PIP_CUE_SIZE
        if (this.media) {
            this.inPip = document.pictureInPictureElement === this.media
            this.media.addEventListener(
                'enterpictureinpicture',
                this.onEnterPip
            )
            this.media.addEventListener(
                'leavepictureinpicture',
                this.onLeavePip
            )
        }
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
        this.restoreCues()
        this.track?.removeEventListener('cuechange', this.onCueChange)
        this.track = track
        // Drop the previous track's authored styles; the new one supplies its
        // own via setStyles once loaded.
        this.styleElement.textContent = ''
        if (!track) {
            this.element.replaceChildren(this.styleElement)
            return
        }
        if (this.inPip) {
            track.mode = 'showing'
            this.narrowCues()
        }
        track.addEventListener('cuechange', this.onCueChange)
        this.renderActiveCues()
    }

    setStyles(styles: readonly string[]): void {
        this.styleElement.textContent = styles.map(scopeCueRules).join('\n')
    }

    dispose(): void {
        this.setTextTrack(null)
        this.media?.removeEventListener(
            'enterpictureinpicture',
            this.onEnterPip
        )
        this.media?.removeEventListener(
            'leavepictureinpicture',
            this.onLeavePip
        )
    }

    private setInPip(inPip: boolean): void {
        if (inPip === this.inPip) return
        this.inPip = inPip
        const track = this.track
        if (!track) return
        // Mode changes keep the cues; only 'disabled' empties `cues`.
        track.mode = inPip ? 'showing' : 'hidden'
        if (inPip) this.narrowCues()
        else this.restoreCues()
        this.renderActiveCues()
    }

    /**
     * Narrows the attached track's full-width cues to pipCueSize. Runs on each
     * cuechange too, since cues keep loading while in picture-in-picture.
     */
    private narrowCues(): void {
        const cues = this.track?.cues
        if (!cues) return
        for (let i = 0; i < cues.length; i++) {
            const cue = cues[i] as Partial<VTTCue>
            if (cue.size === 100 && this.pipCueSize !== 100) {
                cue.size = this.pipCueSize
                this.narrowed.add(cue as VTTCue)
            }
        }
    }

    /** Restores the cues {@link narrowCues} narrowed. */
    private restoreCues(): void {
        for (const cue of this.narrowed) cue.size = 100
        this.narrowed.clear()
    }

    private renderActiveCues(): void {
        // Only invoked while a track is attached (from setTextTrack / cuechange).
        // In picture-in-picture the browser paints; draw nothing over the page.
        const active = this.inPip ? [] : (this.track!.activeCues ?? [])
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
