/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type CueGeometry,
    computeCueLayout,
    renderCueText,
    HtmlTextTrackRenderer,
} from '@amazon/vinyl'

describe('computeCueLayout', () => {
    it('flows a cue with no line/position (defaults: center, full width)', () => {
        expect(computeCueLayout({})).toEqual({
            textAlign: 'center',
            maxWidth: '100%',
        })
    })

    it('maps align and size', () => {
        const layout = computeCueLayout({ align: 'start', size: 80 })
        expect(layout.textAlign).toBe('start')
        expect(layout.maxWidth).toBe('80%')
    })

    it('maps vertical writing modes', () => {
        expect(computeCueLayout({ vertical: 'rl' }).writingMode).toBe(
            'vertical-rl'
        )
        expect(computeCueLayout({ vertical: 'lr' }).writingMode).toBe(
            'vertical-lr'
        )
    })

    it('centers horizontally and bottom-anchors when only a line is set', () => {
        // line 40% (snapToLines false), default lineAlign → top:40%.
        const layout = computeCueLayout({ line: 40, snapToLines: false })
        expect(layout.position).toBe('absolute')
        expect(layout.left).toBe('50%')
        expect(layout.top).toBe('40%')
        expect(layout.transform).toBe('translateX(-50%)')
    })

    it('percentage line honors lineAlign end and center', () => {
        expect(
            computeCueLayout({ line: 20, snapToLines: false, lineAlign: 'end' })
                .bottom
        ).toBe('80%')
        const center = computeCueLayout({
            line: 30,
            snapToLines: false,
            lineAlign: 'center',
        })
        expect(center.top).toBe('30%')
        expect(center.transform).toContain('translateY(-50%)')
    })

    it('snap-to-lines integer line: negative counts up from the bottom', () => {
        expect(computeCueLayout({ line: -3, snapToLines: true }).bottom).toBe(
            '3em'
        )
        expect(computeCueLayout({ line: 2, snapToLines: true }).top).toBe('3em')
    })

    it('positions horizontally by positionAlign', () => {
        expect(
            computeCueLayout({ position: 20, positionAlign: 'line-left' }).left
        ).toBe('20%')
        expect(
            computeCueLayout({ position: 20, positionAlign: 'line-right' })
                .right
        ).toBe('80%')
        const center = computeCueLayout({
            position: 30,
            positionAlign: 'center',
        })
        expect(center.left).toBe('30%')
        expect(center.transform).toBe('translateX(-50%)')
    })

    it('a position without a line bottom-anchors', () => {
        expect(computeCueLayout({ position: 10 }).bottom).toBe('0')
    })
})

describe('renderCueText', () => {
    it('escapes plain text and turns newlines into <br>', () => {
        expect(renderCueText('a & b\nc')).toBe('a &amp; b<br>c')
    })

    it('escapes a stray < that is not a tag', () => {
        expect(renderCueText('a < b')).toBe('a &lt; b')
    })

    it('converts <c.class> to a styled span', () => {
        expect(renderCueText('<c.styledotitalic>hi</c>')).toBe(
            '<span class="styledotitalic">hi</span>'
        )
    })

    it('joins multiple cue classes', () => {
        expect(renderCueText('<c.a.b>x</c>')).toBe('<span class="a b">x</span>')
    })

    it('passes through i/b/u tags', () => {
        expect(renderCueText('<i>x</i><b>y</b><u>z</u>')).toBe(
            '<i>x</i><b>y</b><u>z</u>'
        )
    })

    it('maps voice and lang tags to spans with attributes', () => {
        expect(renderCueText('<v Bob>hi</v>')).toBe(
            '<span title="Bob">hi</span>'
        )
        expect(renderCueText('<lang en>x</lang>')).toBe(
            '<span lang="en">x</span>'
        )
    })

    it('renders voice/lang without an annotation as a bare span', () => {
        expect(renderCueText('<v>hi</v>')).toBe('<span>hi</span>')
        expect(renderCueText('<lang>x</lang>')).toBe('<span>x</span>')
    })

    it('escapes annotation values', () => {
        expect(renderCueText('<v a"b>x</v>')).toBe(
            '<span title="a&quot;b">x</span>'
        )
    })

    it('drops timestamp tags and unknown tags', () => {
        expect(renderCueText('<00:00:01.000>a')).toBe('a')
        expect(renderCueText('<xyz>a</xyz>')).toBe('a')
    })
})

describe('HtmlTextTrackRenderer', () => {
    interface FakeElement {
        style: Record<string, string>
        className: string
        innerHTML: string
        textContent: string
        children: unknown[]
        appendChild(node: unknown): void
        replaceChildren(...nodes: unknown[]): void
    }

    function fakeElement(): FakeElement {
        return {
            style: {},
            className: '',
            innerHTML: '',
            textContent: '',
            children: [],
            appendChild(node) {
                this.children.push(node)
            },
            replaceChildren(...nodes) {
                this.children = nodes
            },
        }
    }

    // Reads children as an array so it works with both the Node fake (a plain
    // array) and a real browser (a live HTMLCollection).
    function domChildren(): FakeElement[] {
        return Array.from(
            (container as unknown as { children: ArrayLike<unknown> }).children
        ) as FakeElement[]
    }

    /** The rendered cue boxes (excluding the internal <style> element). */
    function cueBoxes(): FakeElement[] {
        return domChildren().filter((c) => c.className === 'vinyl-text-cue')
    }

    /** The internal <style> element (always the first child). */
    function styleElement(): FakeElement {
        return domChildren()[0]
    }

    class FakeTextTrack {
        activeCues: readonly unknown[] | null = []
        readonly listeners = new Map<string, () => void>()
        addEventListener = jasmine
            .createSpy('addEventListener')
            .and.callFake((type: string, fn: () => void) =>
                this.listeners.set(type, fn)
            )
        removeEventListener = jasmine
            .createSpy('removeEventListener')
            .and.callFake((type: string) => this.listeners.delete(type))
        fireCueChange(): void {
            this.listeners.get('cuechange')?.()
        }
    }

    function cue(text: string, geometry: CueGeometry = {}): unknown {
        return { text, ...geometry }
    }

    let view: HtmlTextTrackRenderer
    let container: FakeElement
    // In Node there is no DOM, so stub `document`; in a real browser (the integ
    // bundle) `document` is a read-only global — use it as-is and only fake when
    // absent.
    let stubbedDocument = false

    beforeEach(() => {
        if (typeof document === 'undefined') {
            ;(globalThis as { document?: unknown }).document = {
                createElement: () => fakeElement(),
            }
            stubbedDocument = true
        }
        view = new HtmlTextTrackRenderer()
        container = view.element as unknown as FakeElement
    })

    afterEach(() => {
        view.dispose()
        if (stubbedDocument) {
            delete (globalThis as { document?: unknown }).document
            stubbedDocument = false
        }
    })

    it('creates a positioned overlay container', () => {
        expect(container.className).toBe('vinyl-text-container')
        expect(container.style.justifyContent).toBe('flex-end')
        expect(container.style.pointerEvents).toBe('none')
    })

    it('renders the active cues, escaping text and applying layout', () => {
        const track = new FakeTextTrack()
        track.activeCues = [cue('hi\nthere', { align: 'start' })]
        view.setTextTrack(track as unknown as TextTrack)

        expect(track.addEventListener).toHaveBeenCalledWith(
            'cuechange',
            jasmine.any(Function)
        )
        const boxes = cueBoxes()
        expect(boxes.length).toBe(1)
        expect(boxes[0].innerHTML).toBe('hi<br>there')
        expect(boxes[0].style.textAlign).toBe('start')
    })

    it('re-renders on cuechange', () => {
        const track = new FakeTextTrack()
        track.activeCues = []
        view.setTextTrack(track as unknown as TextTrack)
        expect(cueBoxes().length).toBe(0)
        track.activeCues = [cue('now showing')]
        track.fireCueChange()
        expect(cueBoxes().length).toBe(1)
    })

    it('renders an empty box for a cue with no text', () => {
        const track = new FakeTextTrack()
        track.activeCues = [{ align: 'center' }] // no `text`
        view.setTextTrack(track as unknown as TextTrack)
        expect(cueBoxes()[0].innerHTML).toBe('')
    })

    it('handles a track with null activeCues', () => {
        const track = new FakeTextTrack()
        track.activeCues = null
        view.setTextTrack(track as unknown as TextTrack)
        expect(cueBoxes().length).toBe(0)
    })

    it('is a no-op when set to the same track', () => {
        const track = new FakeTextTrack()
        view.setTextTrack(track as unknown as TextTrack)
        view.setTextTrack(track as unknown as TextTrack)
        expect(track.addEventListener).toHaveBeenCalledTimes(1)
    })

    it('detaches and clears when set to null', () => {
        const track = new FakeTextTrack()
        track.activeCues = [cue('bye')]
        view.setTextTrack(track as unknown as TextTrack)
        view.setTextTrack(null)
        expect(track.removeEventListener).toHaveBeenCalledWith(
            'cuechange',
            jasmine.any(Function)
        )
        expect(cueBoxes().length).toBe(0)
    })

    it('injects authored STYLE rules with ::cue selectors rewritten', () => {
        view.setStyles([
            '::cue(.loud) { font-weight: bold }\n::cue { color: red }',
        ])
        const style = styleElement()
        expect(style.textContent).toBe(
            '.vinyl-text-cue .loud { font-weight: bold }\n.vinyl-text-cue { color: red }'
        )
    })

    it('clears authored styles when the track changes', () => {
        view.setStyles(['::cue { color: red }'])
        const style = styleElement()
        expect(style.textContent).not.toBe('')
        view.setTextTrack(new FakeTextTrack() as unknown as TextTrack)
        expect(style.textContent).toBe('')
    })

    it('dispose detaches the current track', () => {
        const track = new FakeTextTrack()
        view.setTextTrack(track as unknown as TextTrack)
        view.dispose()
        expect(track.removeEventListener).toHaveBeenCalled()
    })
})
