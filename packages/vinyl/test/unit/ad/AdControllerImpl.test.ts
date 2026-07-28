/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdControllerImpl } from '@amazon/vinyl'
import type { AdBreakInfo } from '@amazon/vinyl'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'

describe('AdControllerImpl', () => {
    let playbackController: MockPlaybackController

    beforeEach(() => {
        playbackController = new MockPlaybackController()
    })

    function createController(opts?: { trackFactory?: any }) {
        return new AdControllerImpl({
            playbackController,
            ...opts,
        })
    }

    function updateTime(_c: AdControllerImpl, time: number) {
        playbackController.currentTime = time
        playbackController.dispatch('timeUpdate', {
            previous: 0,
            current: time,
        })
    }

    function makeBreak(overrides: Partial<AdBreakInfo> = {}): AdBreakInfo {
        return {
            id: 'b1',
            startTime: 10,
            duration: 5,
            placement: 'midroll',
            ads: [{ id: 'a1', startTime: 10, duration: 5, uri: 'ad.m3u8' }],
            ...overrides,
        }
    }

    it('starts with no breaks and no active break', () => {
        const c = createController()
        expect(c.adBreaks).toEqual([])
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreaksChange when the list changes', () => {
        const c = createController()
        const events: AdBreakInfo[][] = []
        c.on('adBreaksChange', (e) => events.push([...e.current]))
        const breaks = [makeBreak()]
        c.setAdBreaks(breaks)
        expect(events.length).toBe(1)
        expect(events[0].map((b) => b.id)).toEqual(['b1'])
        expect(c.adBreaks.map((b) => b.id)).toEqual(['b1'])
    })

    it('does not re-emit when set to an equal list', () => {
        const c = createController()
        let count = 0
        c.on('adBreaksChange', () => count++)
        c.setAdBreaks([makeBreak()])
        c.setAdBreaks([makeBreak()])
        expect(count).toBe(1)
    })

    it('sorts breaks by start time', () => {
        const c = createController()
        c.setAdBreaks([
            makeBreak({ id: 'late', startTime: 30 }),
            makeBreak({ id: 'early', startTime: 5 }),
        ])
        expect(c.adBreaks.map((b) => b.id)).toEqual(['early', 'late'])
    })

    it('emits adBreakChange when the playhead crosses into a break', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 5 })])
        const entered: (string | null)[] = []
        c.on('adBreakChange', (e) => entered.push(e.current?.id ?? null))

        updateTime(c, 9)
        expect(entered).toEqual([])
        expect(c.activeAdBreak).toBeNull()

        updateTime(c, 10)
        expect(entered).toEqual(['b1'])
        expect(c.activeAdBreak?.id).toBe('b1')
    })

    it('emits adBreakChange to null when the playhead leaves a break', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 5 })])
        const events: { previous: string | null; current: string | null }[] = []
        c.on('adBreakChange', (e) =>
            events.push({
                previous: e.previous?.id ?? null,
                current: e.current?.id ?? null,
            })
        )

        updateTime(c, 12)
        expect(c.activeAdBreak?.id).toBe('b1')
        updateTime(c, 15) // endTime is exclusive: 10 + 5
        expect(events).toEqual([
            { previous: null, current: 'b1' },
            { previous: 'b1', current: null },
        ])
        expect(c.activeAdBreak).toBeNull()
    })

    it('does not re-emit while remaining inside the same break', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 10 })])
        let changes = 0
        c.on('adBreakChange', () => changes++)
        updateTime(c, 11)
        updateTime(c, 12)
        updateTime(c, 13)
        expect(changes).toBe(1)
    })

    it('transitions directly between adjacent breaks', () => {
        const c = createController()
        c.setAdBreaks([
            makeBreak({ id: 'a', startTime: 0, duration: 10 }),
            makeBreak({ id: 'b', startTime: 10, duration: 10 }),
        ])
        // Break A is immediately active (currentTime=0 is within A).
        expect(c.activeAdBreak?.id).toBe('a')
        const changes: { previous: string | null; current: string | null }[] =
            []
        c.on('adBreakChange', (e) =>
            changes.push({
                previous: e.previous?.id ?? null,
                current: e.current?.id ?? null,
            })
        )
        updateTime(c, 15)
        expect(changes).toEqual([{ previous: 'a', current: 'b' }])
        expect(c.activeAdBreak?.id).toBe('b')
    })

    it('treats null-duration breaks as never containing the playhead', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: null })])
        updateTime(c, 10)
        updateTime(c, 11)
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreakChange to null when the active break is removed from the list', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 10 })])
        updateTime(c, 12)
        const exited: (string | null)[] = []
        c.on('adBreakChange', (e) => exited.push(e.current?.id ?? null))
        c.setAdBreaks([])
        expect(exited).toEqual([null])
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreakChange to null on dispose when a break is active', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
        updateTime(c, 5)
        const events: { previous: string | null; current: string | null }[] = []
        c.on('adBreakChange', (e) =>
            events.push({
                previous: e.previous?.id ?? null,
                current: e.current?.id ?? null,
            })
        )
        c.dispose()
        expect(events).toEqual([{ previous: 'b1', current: null }])
    })

    it('does not activate a break with empty ads array', () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 0, duration: 10, ads: [] })])
        updateTime(c, 5)
        expect(c.activeAdBreak).toBeNull()
    })

    describe('skipAd', () => {
        it('is a no-op when no break is active', () => {
            const c = createController()
            c.setAdBreaks([makeBreak()])
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakChange', spy)
            c.skipAd()
            expect(spy).not.toHaveBeenCalled()
        })

        it('emits adBreakChange to null when a break is active', () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
            updateTime(c, 5)
            const events: any[] = []
            c.on('adBreakChange', (e) => events.push(e))
            c.skipAd()
            expect(events.length).toBe(1)
            expect(events[0].current).toBeNull()
            expect(c.activeAdBreak).toBeNull()
        })

        it('prevents re-entry after skip', () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
            updateTime(c, 5)
            c.skipAd()
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakChange', spy)
            updateTime(c, 7)
            expect(spy).not.toHaveBeenCalled()
            expect(c.activeAdBreak).toBeNull()
        })
    })

    describe('skipAdBreak', () => {
        it('is a no-op when no break is active', () => {
            const c = createController()
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakChange', spy)
            c.skipAdBreak()
            expect(spy).not.toHaveBeenCalled()
        })

        it('emits adBreakChange to null when a break is active', () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
            updateTime(c, 5)
            const events: any[] = []
            c.on('adBreakChange', (e) => events.push(e))
            c.skipAdBreak()
            expect(events.length).toBe(1)
            expect(events[0].current).toBeNull()
        })
    })

    describe('ad tracks', () => {
        function mockTrackFactory() {
            const tracks: any[] = []
            const createTrack = (opts: any) => {
                const track = {
                    uri: opts.uri,
                    type: opts.type,
                    disposed: false,
                    dispose() {
                        this.disposed = true
                    },
                }
                tracks.push(track)
                return track as any
            }
            return {
                factory: {
                    validate: () => {},
                    createTrack,
                    createAdTrack: createTrack,
                },
                tracks,
            }
        }

        it('uses createAdTrack to create ad sub-tracks', () => {
            const createAdTrack = jasmine
                .createSpy('createAdTrack')
                .and.callFake((opts: any) => ({
                    uri: opts.uri,
                    type: opts.type,
                    disposed: false,
                    dispose() {
                        this.disposed = true
                    },
                }))
            const c = createController({
                trackFactory: {
                    validate: () => {},
                    createTrack: () => {
                        throw new Error('should not be called')
                    },
                    createAdTrack,
                },
            })
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 5,
                            uri: 'ad.m3u8',
                        },
                    ],
                }),
            ])
            expect(createAdTrack).toHaveBeenCalled()
        })

        it('returns null from getAdTrack when no trackFactory', () => {
            const c = createController()
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 15,
                            uri: 'https://example.com/ad.m3u8',
                        },
                    ],
                }),
            ])
            expect(c.getAdTrack('a1')).toBeNull()
        })

        it('creates tracks for ads with resolvable URIs', () => {
            const { factory, tracks } = mockTrackFactory()
            const c = createController({ trackFactory: factory })
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 15,
                            uri: 'https://example.com/ad.m3u8',
                        },
                    ],
                }),
            ])
            expect(tracks.length).toBe(1)
            expect(tracks[0].uri).toBe('https://example.com/ad.m3u8')
            expect(tracks[0].type).toBe('hls')
            expect(c.getAdTrack('a1')).toBe(tracks[0])
        })

        it('does not create tracks for ads with null URI', () => {
            const { factory, tracks } = mockTrackFactory()
            const c = createController({ trackFactory: factory })
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 15,
                            uri: null,
                        },
                    ],
                }),
            ])
            expect(tracks.length).toBe(0)
            expect(c.getAdTrack('a1')).toBeNull()
        })

        it('does not create tracks for unresolvable URIs', () => {
            const { factory, tracks } = mockTrackFactory()
            const c = createController({ trackFactory: factory })
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 15,
                            uri: 'https://example.com/unknown',
                        },
                    ],
                }),
            ])
            expect(tracks.length).toBe(0)
        })

        it('disposes previous tracks on setAdBreaks', () => {
            const { factory, tracks } = mockTrackFactory()
            const c = createController({ trackFactory: factory })
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 15,
                            uri: 'https://example.com/ad1.m3u8',
                        },
                    ],
                }),
            ])
            const firstTrack = tracks[0]
            c.setAdBreaks([
                makeBreak({
                    id: 'b2',
                    ads: [
                        {
                            id: 'a2',
                            startTime: 20,
                            duration: 10,
                            uri: 'https://example.com/ad2.mpd',
                        },
                    ],
                }),
            ])
            expect(firstTrack.disposed).toBeTrue()
            expect(c.getAdTrack('a1')).toBeNull()
            expect(c.getAdTrack('a2')).not.toBeNull()
        })

        it('disposes tracks on controller dispose', () => {
            const { factory, tracks } = mockTrackFactory()
            const c = createController({ trackFactory: factory })
            c.setAdBreaks([
                makeBreak({
                    ads: [
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 15,
                            uri: 'https://example.com/ad.mp4',
                        },
                    ],
                }),
            ])
            c.dispose()
            expect(tracks[0].disposed).toBeTrue()
        })

        it('fetches X-ASSET-LIST and creates tracks from the response', async () => {
            const { factory, tracks } = mockTrackFactory()
            const assetListResponse = {
                ASSETS: [
                    { URI: 'https://example.com/mid1.m3u8', DURATION: 10 },
                    { URI: 'https://example.com/mid2.m3u8', DURATION: 15 },
                ],
            }
            const origFetch = globalThis.fetch
            globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
                json: () => Promise.resolve(assetListResponse),
            })

            try {
                const c = createController({ trackFactory: factory })
                c.setAdBreaks([
                    makeBreak({
                        id: 'b-list',
                        ads: [],
                        assetListUrl: 'https://example.com/ads.json',
                    }),
                ])

                await new Promise((r) => setTimeout(r, 0))
                await new Promise((r) => setTimeout(r, 0))

                expect(globalThis.fetch).toHaveBeenCalledWith(
                    'https://example.com/ads.json'
                )
                expect(tracks.length).toBe(2)
                expect(c.getAdTrack('b-list-0')).toBe(tracks[0])
                expect(c.getAdTrack('b-list-1')).toBe(tracks[1])

                const updatedBreak = c.adBreaks.find((b) => b.id === 'b-list')
                expect(updatedBreak?.ads.length).toBe(2)
            } finally {
                globalThis.fetch = origFetch
            }
        })

        it('handles assets without DURATION and preserves other breaks', async () => {
            const { factory, tracks } = mockTrackFactory()
            const origFetch = globalThis.fetch
            globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
                json: () =>
                    Promise.resolve({
                        ASSETS: [
                            { URI: 'https://example.com/ad.m3u8' },
                            { URI: 'https://example.com/unknown' },
                        ],
                    }),
            })

            try {
                const c = createController({ trackFactory: factory })
                c.setAdBreaks([
                    makeBreak({ id: 'other', startTime: 5 }),
                    makeBreak({
                        id: 'b-list',
                        startTime: 20,
                        ads: [],
                        assetListUrl: 'https://example.com/ads.json',
                    }),
                ])

                await new Promise((r) => setTimeout(r, 0))
                await new Promise((r) => setTimeout(r, 0))

                // Only one track created (unknown URI filtered out)
                expect(tracks.length).toBe(2) // 1 from 'other' + 1 from asset list
                const listBreak = c.adBreaks.find((b) => b.id === 'b-list')
                expect(listBreak?.ads[0].duration).toBeNull()
                // Other break preserved
                expect(c.adBreaks.find((b) => b.id === 'other')).toBeDefined()
            } finally {
                globalThis.fetch = origFetch
            }
        })

        it('handles fetch failure gracefully', async () => {
            const { factory } = mockTrackFactory()
            const origFetch = globalThis.fetch
            globalThis.fetch = jasmine
                .createSpy('fetch')
                .and.rejectWith(new Error('network'))

            try {
                const c = createController({ trackFactory: factory })
                c.setAdBreaks([
                    makeBreak({
                        ads: [],
                        assetListUrl: 'https://example.com/ads.json',
                    }),
                ])

                await new Promise((r) => setTimeout(r, 0))
                expect(c.adBreaks.length).toBe(1)
            } finally {
                globalThis.fetch = origFetch
            }
        })

        it('handles missing ASSETS in JSON response', async () => {
            const { factory, tracks } = mockTrackFactory()
            const origFetch = globalThis.fetch
            globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
                json: () => Promise.resolve({}),
            })

            try {
                const c = createController({ trackFactory: factory })
                c.setAdBreaks([
                    makeBreak({
                        id: 'b-empty',
                        ads: [],
                        assetListUrl: 'https://example.com/ads.json',
                    }),
                ])

                await new Promise((r) => setTimeout(r, 0))
                await new Promise((r) => setTimeout(r, 0))
                expect(tracks.length).toBe(0)
                expect(c.getAdTrack('b-empty-0')).toBeNull()
            } finally {
                globalThis.fetch = origFetch
            }
        })

        it('skips assets with no URI in the response', async () => {
            const { factory, tracks } = mockTrackFactory()
            const origFetch = globalThis.fetch
            globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo({
                json: () =>
                    Promise.resolve({
                        ASSETS: [
                            { DURATION: 10 }, // no URI
                            { URI: 'https://example.com/ad.m3u8', DURATION: 5 },
                        ],
                    }),
            })

            try {
                const c = createController({ trackFactory: factory })
                c.setAdBreaks([
                    makeBreak({
                        id: 'b-null',
                        ads: [],
                        assetListUrl: 'https://example.com/ads.json',
                    }),
                ])

                await new Promise((r) => setTimeout(r, 0))
                await new Promise((r) => setTimeout(r, 0))
                // Only the second asset (with URI) gets a track
                expect(tracks.length).toBe(1)
            } finally {
                globalThis.fetch = origFetch
            }
        })
    })
})
