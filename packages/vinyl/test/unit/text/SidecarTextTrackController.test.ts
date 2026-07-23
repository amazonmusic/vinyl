/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { SidecarTextTrackController, type TextTrackInfo } from '@amazon/vinyl'
import { requesterWithRetryRef } from '@amazon/vinyl-util'
import { flushPromises } from '@amazon/vinyl-util/browserTestUtil'
import { MockRequester } from '@amazon/vinyl-util/testUtil'

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
    cues: TextTrackCue[]
    addCue(cue: TextTrackCue): void
    removeCue(cue: TextTrackCue): void
}

class FakeMediaElement {
    readonly addTextTrack = jasmine
        .createSpy<HTMLMediaElement['addTextTrack']>('addTextTrack')
        .and.callFake((kind, label, language) => {
            const track: FakeTextTrack = {
                kind,
                label: label ?? '',
                language: language ?? '',
                mode: 'disabled',
                cues: [],
                addCue(cue) {
                    this.cues.push(cue)
                },
                removeCue(cue) {
                    const i = this.cues.indexOf(cue)
                    if (i >= 0) this.cues.splice(i, 1)
                },
            }
            this.lastTrack = track
            return track as unknown as TextTrack
        })

    lastTrack: FakeTextTrack | null = null
    currentTime = 0
}

function makeTrack(overrides: Partial<TextTrackInfo> = {}): TextTrackInfo {
    return {
        id: 'a',
        kind: 'subtitles',
        language: 'en',
        label: 'English',
        default: false,
        uri: 'https://x.test/a.vtt',
        mimeType: 'text/vtt',
        ...overrides,
    }
}

describe('SidecarTextTrackController', () => {
    let media: FakeMediaElement
    let controller: SidecarTextTrackController
    let requester: MockRequester
    let originalCue: typeof globalThis.VTTCue

    beforeEach(() => {
        requester = new MockRequester()
        requesterWithRetryRef.set(() => requester)
        media = new FakeMediaElement()
        controller = new SidecarTextTrackController({
            media: media as unknown as HTMLMediaElement,
        })
        originalCue = (globalThis as any).VTTCue
        // Provide a minimal VTTCue stub for jsdom-less node environment.
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
        }
    })

    afterEach(() => {
        controller.dispose()
        ;(globalThis as any).VTTCue = originalCue
    })

    function respondVtt(body: string) {
        requester.request.and.resolveTo(new Response(body))
    }

    it('starts with no tracks and no active selection', () => {
        expect(controller.textTracks).toEqual([])
        expect(controller.activeTextTrack).toBeNull()
    })

    it('emits textTracksChange when discovered list changes', () => {
        const handler = jasmine.createSpy('textTracksChange')
        controller.on('textTracksChange', handler)
        const t = makeTrack()
        controller.setTextTracks([t])
        expect(handler).toHaveBeenCalledTimes(1)
        // Same list contents → no event.
        controller.setTextTracks([t])
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('detects changed track properties', () => {
        const handler = jasmine.createSpy()
        controller.on('textTracksChange', handler)
        controller.setTextTracks([makeTrack({ label: 'A' })])
        controller.setTextTracks([makeTrack({ label: 'B' })])
        expect(handler).toHaveBeenCalledTimes(2)
    })

    it('selecting a known id loads cues and creates a TextTrack', async () => {
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nfirst`)
        const t = makeTrack()
        controller.setTextTracks([t])
        const activeChange = jasmine.createSpy()
        controller.on('activeTextTrackChange', activeChange)
        controller.setActiveTextTrack(t.id)
        expect(controller.activeTextTrack).toBe(t)
        expect(activeChange).toHaveBeenCalledTimes(1)
        // Wait for the load chain (fetch -> text -> parse -> onCues) to resolve.
        await flushUntil(() => (media.lastTrack?.cues.length ?? 0) > 0)
        expect(media.addTextTrack).toHaveBeenCalledWith(
            'subtitles',
            'English',
            'en'
        )
        expect(media.lastTrack?.mode).toBe('showing')
        expect(media.lastTrack?.cues.length).toBe(1)
    })

    it('preserves cue id when present', async () => {
        respondVtt(`WEBVTT\n\nidA\n00:00:01.000 --> 00:00:02.000\nfirst`)
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        await flushUntil(() => (media.lastTrack?.cues.length ?? 0) > 0)
        const cue = media.lastTrack?.cues[0] as unknown as { id: string }
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
        const t = makeTrack({ uri: 'https://x.test/sub.m3u8' })
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        // Two segments + dedup: wait until all three distinct cues have loaded.
        await flushUntil(() => (media.lastTrack?.cues.length ?? 0) >= 3)
        const texts = (media.lastTrack?.cues ?? []).map(
            (c) => (c as unknown as { text: string }).text
        )
        expect(texts).toEqual(['only-a', 'shared', 'only-b'])
    })

    it('selecting an unknown id is a no-op', () => {
        const handler = jasmine.createSpy()
        controller.on('activeTextTrackChange', handler)
        controller.setTextTracks([makeTrack()])
        controller.setActiveTextTrack('unknown')
        expect(handler).not.toHaveBeenCalled()
        expect(controller.activeTextTrack).toBeNull()
    })

    it('selecting null clears the current active track', () => {
        respondVtt(`WEBVTT\n`)
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        controller.setActiveTextTrack(null)
        expect(controller.activeTextTrack).toBeNull()
    })

    it('clears active selection when its track is removed', () => {
        respondVtt(`WEBVTT\n`)
        const t1 = makeTrack({ id: 'a' })
        const t2 = makeTrack({ id: 'b', uri: 'https://x.test/b.vtt' })
        controller.setTextTracks([t1, t2])
        controller.setActiveTextTrack('a')
        controller.setTextTracks([t2])
        expect(controller.activeTextTrack).toBeNull()
    })

    it('keeps active selection when track list updates with same active', () => {
        respondVtt(`WEBVTT\n`)
        const t1 = makeTrack({ id: 'a' })
        const t2 = makeTrack({ id: 'b' })
        controller.setTextTracks([t1])
        controller.setActiveTextTrack('a')
        controller.setTextTracks([t1, t2])
        expect(controller.activeTextTrack?.id).toBe('a')
    })

    it('emits textTrackError on fetch failure', async () => {
        requester.request.and.rejectWith(new Error('boom'))
        const onError = jasmine.createSpy('textTrackError')
        controller.on('textTrackError', onError)
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        await flushUntil(() => onError.calls.count() > 0)
        expect(onError).toHaveBeenCalledTimes(1)
        const arg = onError.calls.mostRecent().args[0]
        expect(arg.track).toBe(t)
        expect(arg.error.message).toBe('boom')
    })

    it('wraps non-Error rejections', async () => {
        requester.request.and.rejectWith('plain')
        const onError = jasmine.createSpy()
        controller.on('textTrackError', onError)
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        await flushUntil(() => onError.calls.count() > 0)
        const arg = onError.calls.mostRecent().args[0]
        expect(arg.error.message).toBe('plain')
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
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        controller.setActiveTextTrack(null)
        // Now respond — but the abort has already fired.
        resolveFetch(
            new Response(`WEBVTT\n\n00:00:00.500 --> 00:00:01.500\npost`)
        )
        await flushPromises()
        expect(media.lastTrack?.cues.length ?? 0).toBe(0)
    })

    it('does not emit textTrackError when load is cancelled by switching tracks', async () => {
        // First request hangs until we resolve it. Deactivate the track,
        // then resolve with a rejection — the abort should suppress the error.
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
        const onError = jasmine.createSpy('textTrackError')
        controller.on('textTrackError', onError)
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        // Now cancel by clearing.
        controller.setActiveTextTrack(null)
        rejectFirst(new Error('would-be error'))
        await flushPromises()
        expect(onError).not.toHaveBeenCalled()
    })

    it('switching active track clears the previous DOM cues', async () => {
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
        const a = makeTrack({ id: 'a' })
        const b = makeTrack({
            id: 'b',
            uri: 'https://x.test/b.vtt',
            label: 'Two',
        })
        controller.setTextTracks([a, b])
        controller.setActiveTextTrack('a')
        await flushUntil(() => (media.lastTrack?.cues.length ?? 0) > 0)
        const firstTrack = media.lastTrack
        expect(firstTrack?.cues.length).toBe(1)
        controller.setActiveTextTrack('b')
        // First track should be cleared synchronously on switch.
        expect(firstTrack?.cues.length).toBe(0)
        expect(firstTrack?.mode).toBe('disabled')
        // The second track loads its own cue.
        await flushUntil(
            () =>
                media.lastTrack !== firstTrack &&
                (media.lastTrack?.cues.length ?? 0) > 0
        )
        expect(media.lastTrack?.cues.length).toBe(1)
    })

    it('skips DOM cue creation when no VTTCue ctor is available', async () => {
        ;(globalThis as any).VTTCue = undefined
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nignored`)
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        await flushPromises()
        expect(media.lastTrack?.cues.length).toBe(0)
    })

    it('can run without a DOM media element', async () => {
        const headless = new SidecarTextTrackController({ media: null })
        const t = makeTrack()
        respondVtt(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nx`)
        headless.setTextTracks([t])
        headless.setActiveTextTrack(t.id)
        await flushPromises()
        expect(headless.activeTextTrack).toBe(t)
        headless.dispose()
    })

    it('forwards requestInit when configured', async () => {
        const customController = new SidecarTextTrackController({
            media: media as unknown as HTMLMediaElement,
            requestInit: { credentials: 'include' },
        })
        respondVtt(`WEBVTT\n`)
        const t = makeTrack()
        customController.setTextTracks([t])
        customController.setActiveTextTrack(t.id)
        await flushPromises()
        expect(requester.request).toHaveBeenCalledWith(
            t.uri,
            jasmine.objectContaining({ credentials: 'include' }),
            jasmine.any(Object)
        )
        customController.dispose()
    })

    it('drives HLS caption segment order from the media playhead', async () => {
        // Media at t=12s should cause seg2 (10s..15s) to be fetched first.
        media.currentTime = 12
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
        const t = makeTrack({ uri: 'https://x.test/sub.m3u8' })
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
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
        const t = makeTrack()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        // The DOM TextTrack is created eagerly on activation so cues can be
        // rendered as they arrive during load.
        expect(media.lastTrack).not.toBeNull()
        controller.dispose()
        // Resolving after dispose must not throw or push cues onto the track.
        resolveResponse(
            new Response(`WEBVTT\n\n00:00:00.500 --> 00:00:01.500\npost`)
        )
        await flushPromises()
        expect(media.lastTrack?.mode).toBe('disabled')
        expect(media.lastTrack?.cues.length).toBe(0)
        expect(controller.activeTextTrack).toBeNull()
        expect(controller.textTracks).toEqual([])
    })

    it('handles tracks with null language', async () => {
        respondVtt(`WEBVTT\n`)
        const t = makeTrack({ language: null })
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        await flushPromises()
        expect(media.addTextTrack).toHaveBeenCalledWith(
            'subtitles',
            'English',
            undefined
        )
    })

    it('setTextTracks with same array reference is a no-op', () => {
        const handler = jasmine.createSpy()
        controller.on('textTracksChange', handler)
        const list = [makeTrack()]
        controller.setTextTracks(list)
        controller.setTextTracks(list)
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('clearing active when none is active is a no-op', () => {
        const handler = jasmine.createSpy()
        controller.on('activeTextTrackChange', handler)
        controller.setActiveTextTrack(null)
        expect(handler).not.toHaveBeenCalled()
    })

    it('selecting same id is a no-op', () => {
        respondVtt(`WEBVTT\n`)
        const t = makeTrack()
        const handler = jasmine.createSpy()
        controller.setTextTracks([t])
        controller.setActiveTextTrack(t.id)
        controller.on('activeTextTrackChange', handler)
        controller.setActiveTextTrack(t.id)
        expect(handler).not.toHaveBeenCalled()
    })
})
