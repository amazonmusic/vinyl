/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdControllerImpl } from '@amazon/vinyl'
import type { AdBreakInfo, AdInfo } from '@amazon/vinyl'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'

describe('AdControllerImpl', () => {
    let playbackController: MockPlaybackController

    beforeEach(() => {
        playbackController = new MockPlaybackController()
    })

    function createController() {
        return new AdControllerImpl({ playbackController })
    }

    function updateTime(_c: AdControllerImpl, time: number) {
        playbackController.currentTime = time
        playbackController.dispatch('timeUpdate', {
            previous: 0,
            current: time,
        })
    }

    /**
     * Builds an ad break. `ads` accepts a plain array (wrapped in an immediate
     * resolver) or a resolver function for async cases.
     */
    function makeBreak(
        overrides: Partial<Omit<AdBreakInfo, 'ads'>> & {
            ads?: readonly AdInfo[] | (() => Promise<readonly AdInfo[]>)
        } = {}
    ): AdBreakInfo {
        const { ads, ...rest } = overrides
        const defaultAds: readonly AdInfo[] = [
            { id: 'a1', startTime: 10, duration: 5, uri: 'ad.m3u8' },
        ]
        const adsResolver =
            typeof ads === 'function'
                ? ads
                : () => Promise.resolve(ads ?? defaultAds)
        return {
            id: 'b1',
            startTime: 10,
            duration: 5,
            placement: 'midroll',
            ads: adsResolver,
            ...rest,
        }
    }

    /** Waits for pending microtasks (ad resolution) to settle. */
    async function flush(): Promise<void> {
        await Promise.resolve()
        await Promise.resolve()
    }

    it('starts with no breaks and no active break', () => {
        const c = createController()
        expect(c.adBreaks).toEqual([])
        expect(c.activeAdBreak).toBeNull()
        expect(c.currentAd).toBeNull()
        expect(c.adPlaying).toBeFalse()
    })

    it('emits adBreaksChange when the list changes', () => {
        const c = createController()
        const events: AdBreakInfo[][] = []
        c.on('adBreaksChange', (e) => events.push([...e.current]))
        c.setAdBreaks([makeBreak()])
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

    it('drops skip state for a break absent from a new break set', async () => {
        const c = createController()
        // Load A: enter and skip break 'a'.
        c.setAdBreaks([makeBreak({ id: 'a', startTime: 0, duration: 10 })])
        updateTime(c, 1)
        await flush()
        c.skipAd()
        expect(c.activeAdBreak).toBeNull()

        // Load B: an entirely different break set ('a' is gone). Load A's skip
        // must not leak; if 'a' ever returns it should be playable again.
        c.setAdBreaks([makeBreak({ id: 'b', startTime: 40, duration: 5 })])
        // Load C reintroduces 'a'; its stale skip should have been dropped.
        c.setAdBreaks([makeBreak({ id: 'a', startTime: 20, duration: 10 })])
        updateTime(c, 21)
        await flush()
        expect(c.activeAdBreak?.id).toBe('a')
    })

    it('retains skip state for a break still present alongside a new one', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ id: 'a', startTime: 0, duration: 10 })])
        updateTime(c, 1)
        await flush()
        c.skipAd()
        // A live manifest reveals a second break; 'a' is still present.
        c.setAdBreaks([
            makeBreak({ id: 'a', startTime: 0, duration: 10 }),
            makeBreak({ id: 'b', startTime: 20, duration: 10 }),
        ])
        // 'a' remains skipped and does not re-activate.
        updateTime(c, 5)
        await flush()
        expect(c.activeAdBreak).toBeNull()
    })

    describe('reset', () => {
        it('clears skip history so a reused id can play again', async () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ id: '1', startTime: 0, duration: 10 })])
            updateTime(c, 1)
            await flush()
            c.skipAd()

            // A content change resets all state, then the next content reuses
            // id '1' — it must be playable again.
            c.reset()
            expect(c.adBreaks).toEqual([])
            c.setAdBreaks([makeBreak({ id: '1', startTime: 0, duration: 10 })])
            updateTime(c, 1)
            await flush()
            expect(c.activeAdBreak?.id).toBe('1')
        })

        it('emits adBreakChange to null when a break was active', async () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ id: '1', startTime: 0, duration: 10 })])
            updateTime(c, 1)
            await flush()
            const events: (string | null)[] = []
            c.on('adBreakChange', (e) => events.push(e.current?.id ?? null))
            c.reset()
            expect(events).toEqual([null])
            expect(c.activeAdBreak).toBeNull()
        })

        it('does not emit when no break was active', () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ id: '1', startTime: 50, duration: 10 })])
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakChange', spy)
            c.reset()
            expect(spy).not.toHaveBeenCalled()
        })
    })

    it('sorts breaks by start time', () => {
        const c = createController()
        c.setAdBreaks([
            makeBreak({ id: 'late', startTime: 30 }),
            makeBreak({ id: 'early', startTime: 5 }),
        ])
        expect(c.adBreaks.map((b) => b.id)).toEqual(['early', 'late'])
    })

    it('emits adBreakChange when the playhead crosses into a break', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 5 })])
        const entered: (string | null)[] = []
        c.on('adBreakChange', (e) => entered.push(e.current?.id ?? null))

        updateTime(c, 9)
        await flush()
        expect(entered).toEqual([])
        expect(c.activeAdBreak).toBeNull()

        updateTime(c, 10)
        await flush()
        expect(entered).toEqual(['b1'])
        expect(c.activeAdBreak?.id).toBe('b1')
        expect(c.currentAd?.id).toBe('a1')
    })

    it('emits adBreakChange to null when the ad is skipped', async () => {
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
        await flush()
        expect(c.activeAdBreak?.id).toBe('b1')
        c.skipAd()
        expect(events).toEqual([
            { previous: null, current: 'b1' },
            { previous: 'b1', current: null },
        ])
        expect(c.activeAdBreak).toBeNull()
    })

    it('does not re-emit while remaining inside the same break', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 10 })])
        let changes = 0
        c.on('adBreakChange', () => changes++)
        updateTime(c, 11)
        await flush()
        updateTime(c, 12)
        updateTime(c, 13)
        await flush()
        expect(changes).toBe(1)
    })

    it('transitions between breaks via skipAd then timeUpdate', async () => {
        const c = createController()
        c.setAdBreaks([
            makeBreak({ id: 'a', startTime: 0, duration: 10 }),
            makeBreak({ id: 'b', startTime: 10, duration: 10 }),
        ])
        await flush()
        expect(c.activeAdBreak?.id).toBe('a')
        const changes: { previous: string | null; current: string | null }[] =
            []
        c.on('adBreakChange', (e) =>
            changes.push({
                previous: e.previous?.id ?? null,
                current: e.current?.id ?? null,
            })
        )
        // Skip A, then advance to B's region
        c.skipAd()
        updateTime(c, 15)
        await flush()
        expect(changes).toEqual([
            { previous: 'a', current: null },
            { previous: null, current: 'b' },
        ])
        expect(c.activeAdBreak?.id).toBe('b')
    })

    it('treats null-duration breaks as never containing the playhead', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: null })])
        updateTime(c, 10)
        updateTime(c, 11)
        await flush()
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreakChange to null when the active break is removed from the list', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 10 })])
        updateTime(c, 12)
        await flush()
        const exited: (string | null)[] = []
        c.on('adBreakChange', (e) => exited.push(e.current?.id ?? null))
        c.setAdBreaks([])
        expect(exited).toEqual([null])
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreakChange to null on dispose when a break is active', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
        updateTime(c, 5)
        await flush()
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

    it('skips a break whose resolver returns an empty ad list', async () => {
        const c = createController()
        c.setAdBreaks([makeBreak({ startTime: 0, duration: 10, ads: [] })])
        updateTime(c, 5)
        await flush()
        expect(c.activeAdBreak).toBeNull()
        // The empty break is not re-entered on subsequent updates.
        updateTime(c, 7)
        await flush()
        expect(c.activeAdBreak).toBeNull()
    })

    it('skips a break whose resolver rejects', async () => {
        const c = createController()
        c.setAdBreaks([
            makeBreak({
                startTime: 0,
                duration: 10,
                ads: () => Promise.reject(new Error('boom')),
            }),
        ])
        updateTime(c, 5)
        await flush()
        expect(c.activeAdBreak).toBeNull()
    })

    it('does not activate a break if the playhead leaves before ads resolve', async () => {
        let resolveAds: (ads: readonly AdInfo[]) => void = () => {}
        const c = createController()
        c.setAdBreaks([
            makeBreak({
                startTime: 0,
                duration: 10,
                ads: () =>
                    new Promise<readonly AdInfo[]>((r) => {
                        resolveAds = r
                    }),
            }),
        ])
        updateTime(c, 5)
        // The break is provisionally active but ads have not resolved.
        c.skipAd()
        expect(c.activeAdBreak).toBeNull()
        // Late resolution must not re-activate it.
        resolveAds([{ id: 'a1', startTime: 0, duration: 5, uri: 'ad.m3u8' }])
        await flush()
        expect(c.activeAdBreak).toBeNull()
    })

    it('ignores a late rejection after the playhead has left the break', async () => {
        let rejectAds: (error: Error) => void = () => {}
        const c = createController()
        c.setAdBreaks([
            makeBreak({
                startTime: 0,
                duration: 10,
                ads: () =>
                    new Promise<readonly AdInfo[]>((_resolve, reject) => {
                        rejectAds = reject
                    }),
            }),
        ])
        updateTime(c, 5)
        // Skip the break before the resolver rejects.
        c.skipAd()
        expect(c.activeAdBreak).toBeNull()
        // The late rejection must be a no-op (break already left).
        rejectAds(new Error('boom'))
        await flush()
        expect(c.activeAdBreak).toBeNull()
    })

    describe('currentAd / advanceOrSkipAd', () => {
        function multiAdBreak(): AdBreakInfo {
            return makeBreak({
                startTime: 0,
                duration: 30,
                ads: [
                    { id: 'a1', startTime: 0, duration: 10, uri: 'ad1.m3u8' },
                    { id: 'a2', startTime: 0, duration: 20, uri: 'ad2.m3u8' },
                ],
            })
        }

        it('advances to the next ad in the break', async () => {
            const c = createController()
            c.setAdBreaks([multiAdBreak()])
            updateTime(c, 1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            const changes: (string | null)[] = []
            c.on('adBreakChange', (e) => changes.push(e.current?.id ?? null))
            c.advanceOrSkipAd()
            expect(c.currentAd?.id).toBe('a2')
            expect(changes).toEqual(['b1'])
            expect(c.activeAdBreak?.id).toBe('b1')
        })

        it('skips the break after the last ad', async () => {
            const c = createController()
            c.setAdBreaks([multiAdBreak()])
            updateTime(c, 1)
            await flush()
            c.advanceOrSkipAd() // to a2
            const changes: (string | null)[] = []
            c.on('adBreakChange', (e) => changes.push(e.current?.id ?? null))
            c.advanceOrSkipAd() // past last -> skip
            expect(changes).toEqual([null])
            expect(c.activeAdBreak).toBeNull()
        })

        it('is a no-op when no break is active', () => {
            const c = createController()
            expect(() => c.advanceOrSkipAd()).not.toThrow()
        })
    })

    describe('enterPostrollIfPending', () => {
        it('enters a pending postroll and reports it handled', async () => {
            const c = createController()
            c.setAdBreaks([
                makeBreak({
                    id: 'post',
                    startTime: 60,
                    duration: 10,
                    placement: 'postroll',
                }),
            ])
            const handled = c.enterPostrollIfPending()
            expect(handled).toBeTrue()
            await flush()
            expect(c.activeAdBreak?.id).toBe('post')
        })

        it('returns false when there is no postroll', () => {
            const c = createController()
            c.setAdBreaks([
                makeBreak({ startTime: 0, duration: 10, placement: 'preroll' }),
            ])
            expect(c.enterPostrollIfPending()).toBeFalse()
        })

        it('returns false when a break is already active', async () => {
            const c = createController()
            c.setAdBreaks([
                makeBreak({
                    id: 'post',
                    startTime: 0,
                    duration: 10,
                    placement: 'postroll',
                }),
            ])
            updateTime(c, 1)
            await flush()
            expect(c.enterPostrollIfPending()).toBeFalse()
        })

        it('does not re-enter a postroll that was already played', async () => {
            const c = createController()
            c.setAdBreaks([
                makeBreak({
                    id: 'post',
                    startTime: 60,
                    duration: 10,
                    placement: 'postroll',
                }),
            ])
            expect(c.enterPostrollIfPending()).toBeTrue()
            await flush()
            c.skipAd() // play through / end the postroll
            expect(c.enterPostrollIfPending()).toBeFalse()
        })
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

        it('emits adBreakChange to null when a break is active', async () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
            updateTime(c, 5)
            await flush()
            const events: any[] = []
            c.on('adBreakChange', (e) => events.push(e))
            c.skipAd()
            expect(events.length).toBe(1)
            expect(events[0].current).toBeNull()
            expect(c.activeAdBreak).toBeNull()
        })

        it('prevents re-entry after skip', async () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
            updateTime(c, 5)
            await flush()
            c.skipAd()
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakChange', spy)
            updateTime(c, 7)
            await flush()
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

        it('emits adBreakChange to null when a break is active', async () => {
            const c = createController()
            c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
            updateTime(c, 5)
            await flush()
            const events: any[] = []
            c.on('adBreakChange', (e) => events.push(e))
            c.skipAdBreak()
            expect(events.length).toBe(1)
            expect(events[0].current).toBeNull()
        })
    })
})
