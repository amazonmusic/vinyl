/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createMediaTextTrackProvider } from '@amazon/vinyl'

interface FakeTextTrack {
    kind: string
    label: string | undefined
    language: string | undefined
    mode: TextTrackMode
    cues: TextTrackCue[] | null
    addCue(cue: TextTrackCue): void
    removeCue(cue: TextTrackCue): void
}

/** Minimal media element: a live `textTracks` list and a spied `addTextTrack`. */
class FakeMediaElement {
    readonly tracks: FakeTextTrack[] = []

    readonly addTextTrack = jasmine
        .createSpy<HTMLMediaElement['addTextTrack']>('addTextTrack')
        .and.callFake((kind, label, language) => {
            const track: FakeTextTrack = {
                kind,
                label,
                language,
                mode: 'disabled',
                cues: [],
                addCue(cue) {
                    this.cues!.push(cue)
                },
                removeCue(cue) {
                    const i = this.cues!.indexOf(cue)
                    if (i >= 0) this.cues!.splice(i, 1)
                },
            }
            this.tracks.push(track)
            return track as unknown as TextTrack
        })

    // ArrayLike view over the live tracks (what `isAttached` scans).
    get textTracks(): TextTrackList {
        return this.tracks as unknown as TextTrackList
    }

    asMedia(): HTMLMediaElement {
        return this as unknown as HTMLMediaElement
    }

    cue(): TextTrackCue {
        return { id: '' } as unknown as TextTrackCue
    }
}

describe('createMediaTextTrackProvider', () => {
    let media: FakeMediaElement
    let provider: ReturnType<typeof createMediaTextTrackProvider>

    beforeEach(() => {
        media = new FakeMediaElement()
        provider = createMediaTextTrackProvider({ media: media.asMedia() })
    })

    it('creates a track from the given kind/label/language', () => {
        const ref = provider.getOrCreate('subtitles', 'English', 'en')
        expect(media.addTextTrack).toHaveBeenCalledOnceWith(
            'subtitles',
            'English',
            'en'
        )
        expect(media.tracks).toContain(ref.track as unknown as FakeTextTrack)
    })

    it('memoizes by (kind,label,language) — same key returns the same track', () => {
        const a = provider.getOrCreate('subtitles', 'English', 'en')
        const b = provider.getOrCreate('subtitles', 'English', 'en')
        expect(b).toBe(a)
        expect(media.addTextTrack).toHaveBeenCalledTimes(1)
    })

    it('creates a distinct track per key', () => {
        provider.getOrCreate('subtitles', 'English', 'en')
        provider.getOrCreate('subtitles', 'Espanol', 'es')
        expect(media.addTextTrack).toHaveBeenCalledTimes(2)
    })

    it('recreates a track that was detached from the media element', () => {
        const first = provider.getOrCreate('subtitles', 'English', 'en')
        // Simulate a media-source reset dropping added tracks.
        media.tracks.length = 0
        const second = provider.getOrCreate('subtitles', 'English', 'en')
        expect(second).not.toBe(first)
        expect(media.addTextTrack).toHaveBeenCalledTimes(2)
        expect(media.tracks).toContain(second.track as unknown as FakeTextTrack)
    })

    it('clear() removes all cues from the track', () => {
        const ref = provider.getOrCreate('subtitles', 'English', 'en')
        ref.track.addCue(media.cue())
        ref.track.addCue(media.cue())
        expect(ref.track.cues?.length).toBe(2)
        ref.clear()
        expect(ref.track.cues?.length).toBe(0)
    })

    it('clear() is a no-op when the track has no cues (cues null)', () => {
        const ref = provider.getOrCreate('subtitles', 'English', 'en')
        ;(ref.track as unknown as FakeTextTrack).cues = null
        expect(() => ref.clear()).not.toThrow()
    })
})
