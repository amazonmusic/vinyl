/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type MediaTextTrackProvider,
    type ReadonlyPlaybackController,
    resolveSelectedTrack,
    SidecarTextTrackController,
    type TextTrackControllerOptions,
    type TextTrackInfo,
    type TextTrackRef,
    type TextTrackRenderer,
    type TextTrackSelection,
} from '@amazon/vinyl'
import type { RequestInitOptions } from '@amazon/vinyl-util'
import { requesterWithRetryRef } from '@amazon/vinyl-util'
import { flushPromises } from '@amazon/vinyl-util/browserTestUtil'
import { MockRequester } from '@amazon/vinyl-util/testUtil'
import { data } from '@amazon/vinyl-observable'

/**
 * Flushes the microtask/macrotask queue repeatedly until `predicate` holds or
 * the attempt budget is exhausted. A single {@link flushPromises} is one
 * macrotask, which is enough in Node but not always in a real browser: loading
 * a sidecar VTT chains `fetch -> Response.text() -> parse -> onCues`, and the
 * streamed body read can span several macrotasks. Polling avoids a flaky
 * fixed-tick wait while still failing fast when the condition never becomes
 * true.
 */
async function flushUntil(predicate: () => boolean): Promise<void> {
    for (let i = 0; i < 100 && !predicate(); i++) await flushPromises()
}

interface FakeTextTrack {
    kind: string
    label: string
    language: string
    mode: TextTrackMode
    // `cues` is null while disabled (spec-accurate); `storedCues` always reads.
    readonly cues: TextTrackCue[] | null
    readonly storedCues: TextTrackCue[]
    addCue(cue: TextTrackCue): void
    removeCue(cue: TextTrackCue): void
}

/**
 * A memoized fake provider mirroring {@link MediaTextTrackProvider}: one track
 * per `(kind,label,language)` key, so the number of distinct tracks reveals
 * whether the controller accumulates tracks or reuses them.
 */
class FakeTextTrackProvider implements MediaTextTrackProvider {
    // Every distinct track created (one per rendition key).
    readonly created: FakeTextTrack[] = []
    // The track handed out by the most recent getOrCreate (the active one).
    lastTrack: FakeTextTrack | null = null
    private readonly cache = new Map<string, TextTrackRef>()

    readonly getOrCreate = jasmine
        .createSpy<MediaTextTrackProvider['getOrCreate']>('getOrCreate')
        .and.callFake((kind, label, language) => {
            const key = `${kind}-${label}-${language}`
            const existing = this.cache.get(key)
            if (existing) {
                this.lastTrack = existing.track as unknown as FakeTextTrack
                return existing
            }
            const storedCues: TextTrackCue[] = []
            const track: FakeTextTrack = {
                kind,
                label: label ?? '',
                language: language ?? '',
                mode: 'disabled',
                storedCues,
                // Real TextTrack.cues returns null when mode is 'disabled'.
                get cues() {
                    return this.mode === 'disabled' ? null : storedCues
                },
                addCue(cue) {
                    storedCues.push(cue)
                },
                removeCue(cue) {
                    const i = storedCues.indexOf(cue)
                    if (i >= 0) storedCues.splice(i, 1)
                },
            }
            const ref: TextTrackRef = {
                track: track as unknown as TextTrack,
                clear() {
                    // Mirrors the real ref: cues only clear while not disabled.
                    if (track.mode === 'disabled') return
                    storedCues.length = 0
                },
            }
            this.created.push(track)
            this.cache.set(key, ref)
            this.lastTrack = track
            return ref
        })

    /** Tracks currently rendering captions (showing with at least one cue). */
    showingWithCues(): FakeTextTrack[] {
        return this.created.filter(
            (t) => t.mode === 'showing' && (t.cues?.length ?? 0) > 0
        )
    }
}

function makeTrack(overrides: Partial<TextTrackInfo> = {}): TextTrackInfo {
    return {
        id: 'a',
        kind: 'subtitles',
        language: 'en',
        label: 'English',
        default: false,
        forced: false,
        characteristics: [],
        uri: 'https://x.test/a.vtt',
        mimeType: 'text/vtt',
        ...overrides,
    }
}

describe('SidecarTextTrackController', () => {
    let requester: MockRequester
    let originalCue: typeof globalThis.VTTCue
    const disposers: Array<() => void> = []

    interface Harness {
        controller: SidecarTextTrackController
        provider: FakeTextTrackProvider
        options$: ReturnType<typeof data<TextTrackControllerOptions>>
        textTracks$: ReturnType<typeof data<Promise<readonly TextTrackInfo[]>>>
        playback: { currentTime: number }
        setTracks(tracks: readonly TextTrackInfo[]): Promise<void>
        select(selection: TextTrackSelection): void
    }

    function build(opts?: {
        options?: TextTrackControllerOptions
        requestInit?: RequestInitOptions
        activate?: boolean
        textTrackRenderer?: TextTrackRenderer
    }): Harness {
        const provider = new FakeTextTrackProvider()
        const textTracks$ = data<Promise<readonly TextTrackInfo[]>>(
            Promise.resolve<readonly TextTrackInfo[]>([])
        )
        const options$ = data<TextTrackControllerOptions>(
            opts?.options ?? { selection: {} }
        )
        const playback = { currentTime: 0 }
        const controller = new SidecarTextTrackController({
            textTrackProvider: provider,
            textTracks: textTracks$,
            options: options$,
            playbackController:
                playback as unknown as ReadonlyPlaybackController,
            requestInit: opts?.requestInit,
            textTrackRenderer: opts?.textTrackRenderer,
        })
        // The owning media track activates the controller once current; do the
        // same so cues render (unless a test wants to control activation).
        if (opts?.activate !== false) controller.activate()
        disposers.push(() => controller.dispose())
        return {
            controller,
            provider,
            options$,
            textTracks$,
            playback,
            async setTracks(tracks) {
                textTracks$.value = Promise.resolve(tracks)
                await flushPromises()
            },
            select(selection) {
                options$.value = { ...options$.value, selection }
            },
        }
    }

    beforeEach(() => {
        requester = new MockRequester()
        requesterWithRetryRef.set(() => requester)
        originalCue = (globalThis as any).VTTCue
        // Provide a minimal VTTCue stub for the jsdom-less node environment.
        ;(globalThis as any).VTTCue = function VTTCue(
            this: any,
            startTime: number,
            endTime: number,
            text: string
        ) {
            this.startTime = startTime
            this.endTime = endTime
            this.text = text
            this.id = ''
            this.size = 100
        }
    })

    afterEach(() => {
        for (const dispose of disposers.splice(0)) dispose()
        ;(globalThis as any).VTTCue = originalCue
    })

    function respondVtt(body: string) {
        requester.request.and.resolveTo(new Response(body))
    }

    it('starts with no tracks and no active selection', () => {
        const { controller } = build()
        expect(controller.textTracks).toEqual([])
        expect(controller.activeTextTrack).toBeNull()
    })

    describe('resolveSelectedTrack', () => {
        const full = makeTrack({ id: 'full', language: 'en', forced: false })
        const forced = makeTrack({ id: 'forced', language: 'en', forced: true })
        const captions = makeTrack({
            id: 'cc',
            language: 'en',
            forced: false,
            kind: 'captions',
        })

        it("renders nothing when enabled is 'off' (even with an id)", () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    enabled: 'off',
                    selection: { id: 'full' },
                })
            ).toBeNull()
        })

        it("enabled 'on' selects the full track", () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    enabled: 'on',
                    selection: { language: 'en' },
                })?.id
            ).toBe('full')
        })

        it("enabled 'forced' selects the forced track", () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    enabled: 'forced',
                    selection: { language: 'en' },
                })?.id
            ).toBe('forced')
        })

        it('selection.forced overrides the enabled mode', () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    enabled: 'on',
                    selection: { language: 'en', forced: true },
                })?.id
            ).toBe('forced')
        })

        it('an explicit id wins over other criteria', () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    selection: { id: 'forced', language: 'en', forced: false },
                })?.id
            ).toBe('forced')
        })

        it('unknown id selects nothing', () => {
            expect(
                resolveSelectedTrack([full], { selection: { id: 'nope' } })
            ).toBeNull()
        })

        it('forced defaults to true (only forced tracks)', () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    selection: { language: 'en' },
                })?.id
            ).toBe('forced')
        })

        it('forced:false selects the full track', () => {
            expect(
                resolveSelectedTrack([full, forced], {
                    selection: { language: 'en', forced: false },
                })?.id
            ).toBe('full')
        })

        it('kind restricts the candidate pool', () => {
            expect(
                resolveSelectedTrack([full, captions], {
                    selection: {
                        language: 'en',
                        forced: false,
                        kind: 'captions',
                    },
                })?.id
            ).toBe('cc')
        })

        it('falls back to navigator.languages when no language is given', () => {
            // Node exposes navigator.languages === ['en-US'], relating to 'en'.
            expect(
                resolveSelectedTrack([full], { selection: { forced: false } })
                    ?.id
            ).toBe('full')
        })

        it('an ordered language list prefers earlier entries', () => {
            const es = makeTrack({ id: 'es', language: 'es', forced: false })
            expect(
                resolveSelectedTrack([full, es], {
                    selection: { language: ['es', 'en'], forced: false },
                })?.id
            ).toBe('es')
        })
    })

    it('selecting a known id loads cues and creates a TextTrack', async () => {
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nfirst`)
        const h = build({ options: { selection: { id: 'a' } } })
        const activeChange = jasmine.createSpy()
        h.controller.on('activeTextTrackChange', activeChange)
        await h.setTracks([makeTrack()])
        expect(h.controller.activeTextTrack?.id).toBe('a')
        expect(activeChange).toHaveBeenCalledTimes(1)
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) > 0)
        expect(h.provider.getOrCreate).toHaveBeenCalledWith(
            'subtitles',
            'English',
            'en'
        )
        expect(h.provider.lastTrack?.mode).toBe('showing')
        expect(h.provider.lastTrack?.cues?.length).toBe(1)
    })

    describe('authored cue settings', () => {
        it("applies the cue's own parsed settings to the VTTCue", async () => {
            respondVtt(
                `WEBVTT\n\n00:00:01.000 --> 00:00:02.000 align:left size:80%\nx`
            )
            const h = build({ options: { selection: { id: 'a' } } })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            const cue = h.provider.lastTrack?.cues?.[0] as unknown as {
                align: string
                size: number
            }
            expect(cue.align).toBe('left')
            expect(cue.size).toBe(80)
        })

        it('leaves the cue at defaults when it declares no settings', async () => {
            respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx`)
            const h = build({ options: { selection: { id: 'a' } } })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            // The VTTCue stub defaults size to 100; unset settings don't touch it.
            const cue = h.provider.lastTrack?.cues?.[0] as unknown as {
                size: number
            }
            expect(cue.size).toBe(100)
        })

        it('does not apply settings to non-VTTCue cues', async () => {
            ;(globalThis as any).VTTCue = undefined
            ;(globalThis as any).TextTrackCue = function TextTrackCue(
                this: any,
                start: number,
                end: number,
                text: string
            ) {
                this.startTime = start
                this.endTime = end
                this.text = text
                this.id = ''
                this.size = 100
            }
            respondVtt(
                `WEBVTT\n\n00:00:01.000 --> 00:00:02.000 size:80%\nignored`
            )
            const h = build({ options: { selection: { id: 'a' } } })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            const cue = h.provider.lastTrack?.cues?.[0] as unknown as {
                size: number
            }
            expect(cue.size).toBe(100) // not a VTTCue → never styled
            ;(globalThis as any).TextTrackCue = undefined
        })
    })

    describe('text track renderer', () => {
        function fakeRenderer() {
            return {
                setTextTrack:
                    jasmine.createSpy<(track: TextTrack | null) => void>(
                        'setTextTrack'
                    ),
                setStyles:
                    jasmine.createSpy<(styles: readonly string[]) => void>(
                        'setStyles'
                    ),
            }
        }

        it("keeps the DOM track 'hidden' and hands it to the renderer", async () => {
            respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx`)
            const renderer = fakeRenderer()
            const h = build({
                options: { selection: { id: 'a' } },
                textTrackRenderer: renderer,
            })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            expect(h.provider.lastTrack?.mode).toBe('hidden')
            expect(renderer.setTextTrack).toHaveBeenCalledWith(
                h.provider.lastTrack as unknown as TextTrack
            )
        })

        it('detaches the renderer when captions are turned off', async () => {
            respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx`)
            const renderer = fakeRenderer()
            const h = build({
                options: { selection: { id: 'a' } },
                textTrackRenderer: renderer,
            })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            renderer.setTextTrack.calls.reset()
            h.options$.value = { enabled: 'off' }
            expect(renderer.setTextTrack).toHaveBeenCalledWith(null)
        })

        it('forwards authored STYLE blocks to the renderer', async () => {
            respondVtt(
                `WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00:01.000 --> 00:00:02.000\nx`
            )
            const renderer = fakeRenderer()
            const h = build({
                options: { selection: { id: 'a' } },
                textTrackRenderer: renderer,
            })
            await h.setTracks([makeTrack()])
            await flushUntil(() => renderer.setStyles.calls.count() > 0)
            expect(renderer.setStyles).toHaveBeenCalledWith([
                '::cue { color: red }',
            ])
        })

        it('ignores styles that arrive after the load is cancelled', async () => {
            let resolveFetch: (r: Response) => void = () => {}
            requester.request.and.returnValue(
                new Promise<Response>((res) => {
                    resolveFetch = res
                })
            )
            const renderer = fakeRenderer()
            const h = build({
                options: { selection: { id: 'a' } },
                textTrackRenderer: renderer,
            })
            await h.setTracks([makeTrack()])
            h.options$.value = { enabled: 'off' } // cancels the load
            renderer.setStyles.calls.reset()
            resolveFetch(
                new Response(
                    `WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00:01.000 --> 00:00:02.000\nx`
                )
            )
            await flushPromises()
            expect(renderer.setStyles).not.toHaveBeenCalled()
        })

        it('works with a renderer that cannot consume styles', async () => {
            respondVtt(
                `WEBVTT\n\nSTYLE\n::cue { color: red }\n\n00:00:01.000 --> 00:00:02.000\nx`
            )
            // A renderer implementing only setTextTrack (setStyles is optional).
            const renderer = {
                setTextTrack:
                    jasmine.createSpy<(track: TextTrack | null) => void>(
                        'setTextTrack'
                    ),
            }
            const h = build({
                options: { selection: { id: 'a' } },
                textTrackRenderer: renderer,
            })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            expect(renderer.setTextTrack).toHaveBeenCalled()
        })

        it("renders natively ('showing') when no renderer is injected", async () => {
            respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx`)
            const h = build({ options: { selection: { id: 'a' } } })
            await h.setTracks([makeTrack()])
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            expect(h.provider.lastTrack?.mode).toBe('showing')
        })
    })

    it('preserves cue id when present', async () => {
        respondVtt(`WEBVTT\n\nidA\n00:00:01.000 --> 00:00:02.000\nfirst`)
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) > 0)
        const cue = h.provider.lastTrack?.cues?.[0] as unknown as { id: string }
        expect(cue.id).toBe('idA')
    })

    it('dedupes cues that appear in more than one segment', async () => {
        // HLS caption packagers commonly repeat a cue at the boundary of two
        // adjacent segments. When the loader emits both, the controller must
        // only add it to the DOM TextTrack once.
        const playlistBody = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
a.vtt
#EXTINF:5.0,
b.vtt
#EXT-X-ENDLIST
`
        // Both segments contain the boundary cue "shared" and their own.
        const segA = `WEBVTT\n\n00:00:00.500 --> 00:00:01.500\nonly-a\n\n00:00:04.500 --> 00:00:05.500\nshared`
        const segB = `WEBVTT\n\n00:00:04.500 --> 00:00:05.500\nshared\n\n00:00:07.000 --> 00:00:08.000\nonly-b`
        let call = 0
        requester.request.and.callFake(() => {
            call++
            if (call === 1) return Promise.resolve(new Response(playlistBody))
            if (call === 2) return Promise.resolve(new Response(segA))
            return Promise.resolve(new Response(segB))
        })
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack({ uri: 'https://x.test/sub.m3u8' })])
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) >= 3)
        const texts = (h.provider.lastTrack?.cues ?? []).map(
            (c) => (c as unknown as { text: string }).text
        )
        expect(texts).toEqual(['only-a', 'shared', 'only-b'])
    })

    it('selecting an unknown id renders nothing and stays inactive', async () => {
        const handler = jasmine.createSpy()
        const h = build({ options: { selection: { id: 'unknown' } } })
        h.controller.on('activeTextTrackChange', handler)
        await h.setTracks([makeTrack()])
        expect(handler).not.toHaveBeenCalled()
        expect(h.controller.activeTextTrack).toBeNull()
        expect(h.provider.getOrCreate).not.toHaveBeenCalled()
    })

    it('disabling clears the current active track', async () => {
        respondVtt(`WEBVTT\n`)
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        expect(h.controller.activeTextTrack?.id).toBe('a')
        h.options$.value = { enabled: 'off' }
        expect(h.controller.activeTextTrack).toBeNull()
    })

    it('clears active selection when its track is removed', async () => {
        respondVtt(`WEBVTT\n`)
        const h = build({ options: { selection: { id: 'a' } } })
        const t1 = makeTrack({ id: 'a' })
        const t2 = makeTrack({ id: 'b', uri: 'https://x.test/b.vtt' })
        await h.setTracks([t1, t2])
        expect(h.controller.activeTextTrack?.id).toBe('a')
        await h.setTracks([t2])
        expect(h.controller.activeTextTrack).toBeNull()
    })

    it('keeps the active selection when the list updates with it still present', async () => {
        respondVtt(`WEBVTT\n`)
        const h = build({ options: { selection: { id: 'a' } } })
        const t1 = makeTrack({ id: 'a' })
        const t2 = makeTrack({ id: 'b' })
        await h.setTracks([t1])
        expect(h.controller.activeTextTrack?.id).toBe('a')
        await h.setTracks([t1, t2])
        expect(h.controller.activeTextTrack?.id).toBe('a')
    })

    it('emits textTrackError on fetch failure', async () => {
        requester.request.and.rejectWith(new Error('boom'))
        const h = build({ options: { selection: { id: 'a' } } })
        const onError = jasmine.createSpy('textTrackError')
        h.controller.on('textTrackError', onError)
        const t = makeTrack()
        await h.setTracks([t])
        await flushUntil(() => onError.calls.count() > 0)
        expect(onError).toHaveBeenCalledTimes(1)
        const arg = onError.calls.mostRecent().args[0]
        expect(arg.track).toBe(t)
        expect(arg.error.message).toBe('boom')
    })

    it('wraps non-Error rejections', async () => {
        requester.request.and.rejectWith('plain')
        const h = build({ options: { selection: { id: 'a' } } })
        const onError = jasmine.createSpy()
        h.controller.on('textTrackError', onError)
        await h.setTracks([makeTrack()])
        await flushUntil(() => onError.calls.count() > 0)
        expect(onError.calls.mostRecent().args[0].error.message).toBe('plain')
    })

    it('drops cues that arrive after the load has been cancelled', async () => {
        // Delay the fetch by one macrotask so we can cancel between the
        // network reply and the onCues delivery.
        let resolveFetch: (r: Response) => void = () => {}
        requester.request.and.returnValue(
            new Promise<Response>((res) => {
                resolveFetch = res
            })
        )
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        const track = h.provider.lastTrack
        // Turn captions off — aborts the in-flight load.
        h.options$.value = { enabled: 'off' }
        resolveFetch(
            new Response(`WEBVTT\n\n00:00:00.500 --> 00:00:01.500\npost`)
        )
        await flushPromises()
        expect(track?.storedCues.length ?? 0).toBe(0)
    })

    it('does not emit textTrackError when a load is cancelled by switching', async () => {
        let rejectFirst: (e: Error) => void = () => {}
        let callCount = 0
        requester.request.and.callFake(
            () =>
                new Promise<Response>((_, rej) => {
                    callCount++
                    if (callCount === 1) rejectFirst = rej
                    else rej(new Error('unused'))
                })
        )
        const h = build({ options: { selection: { id: 'a' } } })
        const onError = jasmine.createSpy('textTrackError')
        h.controller.on('textTrackError', onError)
        await h.setTracks([makeTrack()])
        h.options$.value = { enabled: 'off' }
        rejectFirst(new Error('would-be error'))
        await flushPromises()
        expect(onError).not.toHaveBeenCalled()
    })

    it('switching language reuses the per-rendition track and swaps its cues', async () => {
        let call = 0
        requester.request.and.callFake(() => {
            call++
            return Promise.resolve(
                new Response(
                    call === 1
                        ? `WEBVTT\n\n00:00:00.500 --> 00:00:01.500\none`
                        : `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\ntwo`
                )
            )
        })
        const en = makeTrack({ id: 'en', language: 'en', label: 'English' })
        const es = makeTrack({
            id: 'es',
            language: 'es',
            label: 'Espanol',
            uri: 'https://x.test/es.vtt',
        })
        const h = build({ options: { selection: { id: 'en' } } })
        await h.setTracks([en, es])
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) > 0)
        const enTrack = h.provider.lastTrack

        h.select({ id: 'es' })
        // The outgoing English track is hidden and cleared; a distinct Spanish
        // track (its own rendition) renders instead.
        expect(enTrack?.storedCues.length).toBe(0)
        expect(enTrack?.mode).toBe('disabled')
        await flushUntil(
            () =>
                h.provider.lastTrack !== enTrack &&
                (h.provider.lastTrack?.cues?.length ?? 0) > 0
        )
        expect(h.provider.lastTrack).not.toBe(enTrack)
        expect(h.provider.lastTrack?.language).toBe('es')
        expect(h.provider.showingWithCues().length).toBe(1)
    })

    it('cycling languages never accumulates or double-shows cues', async () => {
        requester.request.and.callFake(() =>
            Promise.resolve(
                new Response(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\ncue`)
            )
        )
        const langs = ['en', 'es', 'ja'].map((language) =>
            makeTrack({
                id: language,
                language,
                uri: `https://x.test/${language}.vtt`,
            })
        )
        const h = build({ options: { selection: { id: 'en' } } })
        await h.setTracks(langs)

        for (const id of ['en', 'es', 'ja', 'en']) {
            h.select({ id })
            await flushUntil(
                () => (h.provider.lastTrack?.cues?.length ?? 0) > 0
            )
            expect(h.provider.showingWithCues().length)
                .withContext(`after selecting ${id}`)
                .toBe(1)
        }
        // One track per distinct rendition (3), reused on the repeat of 'en' —
        // never one per activation (which would be 4).
        expect(h.provider.created.length).toBe(3)
    })

    it('deactivate hides the DOM track and activate rebuilds it, keeping the selection', async () => {
        requester.request.and.callFake(() =>
            Promise.resolve(
                new Response(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\none`)
            )
        )
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) > 0)
        const track = h.provider.lastTrack
        expect(track?.mode).toBe('showing')
        expect(h.controller.active).toBeTrue()

        h.controller.deactivate()
        expect(h.controller.active).toBeFalse()
        expect(track?.storedCues.length).toBe(0)
        expect(track?.mode).toBe('disabled')
        expect(h.controller.activeTextTrack?.id).toBe('a')

        h.controller.activate()
        expect(h.controller.active).toBeTrue()
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) > 0)
        expect(h.provider.lastTrack?.mode).toBe('showing')
        expect(h.provider.lastTrack?.cues?.length).toBe(1)
    })

    it('activate is a no-op when nothing is selected', () => {
        const h = build()
        h.controller.activate()
        expect(h.provider.getOrCreate).not.toHaveBeenCalled()
    })

    it('activate is a no-op when already rendering', async () => {
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\none`)
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        await flushUntil(() => (h.provider.lastTrack?.cues?.length ?? 0) > 0)
        h.provider.getOrCreate.calls.reset()
        h.controller.activate()
        expect(h.provider.getOrCreate).not.toHaveBeenCalled()
    })

    it('does not render while deactivated even as the selection resolves', async () => {
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\none`)
        const h = build({
            options: { selection: { id: 'a' } },
            activate: false,
        })
        h.controller.deactivate()
        await h.setTracks([makeTrack()])
        // Selection is tracked, but nothing is rendered until activate().
        expect(h.controller.activeTextTrack?.id).toBe('a')
        expect(h.provider.getOrCreate).not.toHaveBeenCalled()
    })

    it('skips DOM cue creation when no VTTCue ctor is available', async () => {
        ;(globalThis as any).VTTCue = undefined
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nignored`)
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        await flushPromises()
        expect(h.provider.lastTrack?.cues?.length ?? 0).toBe(0)
    })

    it('forwards requestInit when configured', async () => {
        respondVtt(`WEBVTT\n`)
        const h = build({
            options: { selection: { id: 'a' } },
            requestInit: { credentials: 'include' },
        })
        const t = makeTrack()
        await h.setTracks([t])
        await flushPromises()
        expect(requester.request).toHaveBeenCalledWith(
            t.uri,
            jasmine.objectContaining({ credentials: 'include' }),
            jasmine.any(Object)
        )
    })

    it('drives HLS caption segment order from the media playhead', async () => {
        const playlistBody = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXTINF:5.0,
a.vtt
#EXTINF:5.0,
b.vtt
#EXTINF:5.0,
c.vtt
#EXTINF:5.0,
d.vtt
#EXT-X-ENDLIST
`
        const fetched: string[] = []
        let call = 0
        requester.request.and.callFake((url) => {
            call++
            if (call === 1) return Promise.resolve(new Response(playlistBody))
            const path = String(url).split('/').pop()!
            fetched.push(path)
            return Promise.resolve(
                new Response(`WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${path}`)
            )
        })
        const h = build({ options: { selection: { id: 'a' } } })
        // Media at t=12s should cause seg3 (10s..15s) to be fetched first.
        h.playback.currentTime = 12
        await h.setTracks([makeTrack({ uri: 'https://x.test/sub.m3u8' })])
        await flushUntil(() => fetched.length > 0)
        expect(fetched[0]).toBe('c.vtt')
    })

    it('dispose aborts in-flight loads and clears state', async () => {
        let resolveResponse: (r: Response) => void = () => {}
        requester.request.and.callFake(
            () =>
                new Promise<Response>((res) => {
                    resolveResponse = res
                })
        )
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        const track = h.provider.lastTrack
        expect(track).not.toBeNull()
        h.controller.dispose()
        // Resolving after dispose must not throw or push cues onto the track.
        resolveResponse(
            new Response(`WEBVTT\n\n00:00:00.500 --> 00:00:01.500\npost`)
        )
        await flushPromises()
        expect(track?.mode).toBe('disabled')
        expect(track?.storedCues.length).toBe(0)
        expect(h.controller.activeTextTrack).toBeNull()
        expect(h.controller.textTracks).toEqual([])
    })

    it('creates the DOM track with an undefined language for null-language tracks', async () => {
        respondVtt(`WEBVTT\n`)
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack({ language: null })])
        await flushPromises()
        expect(h.provider.getOrCreate).toHaveBeenCalledWith(
            'subtitles',
            'English',
            undefined
        )
    })

    it('setting the same resolved track list twice emits textTracksChange once', async () => {
        const handler = jasmine.createSpy()
        const h = build()
        h.controller.on('textTracksChange', handler)
        const list = [makeTrack()]
        await h.setTracks(list)
        await h.setTracks([makeTrack()]) // deep-equal contents
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('re-selecting the same id is a no-op', async () => {
        respondVtt(`WEBVTT\n`)
        const h = build({ options: { selection: { id: 'a' } } })
        await h.setTracks([makeTrack()])
        const handler = jasmine.createSpy()
        h.controller.on('activeTextTrackChange', handler)
        h.select({ id: 'a' })
        expect(handler).not.toHaveBeenCalled()
    })
})
