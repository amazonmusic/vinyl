/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AdBreakInfo,
    AdBreakResolver,
    AdEventMap,
    AdInfo,
    TrackAds,
} from '@amazon/vinyl'
import { AdControllerImpl } from '@amazon/vinyl'
import { MockPlaybackController, MockTrack } from '@amazon/vinyl/vinylTestUtil'

describe('AdControllerImpl stitched breaks', () => {
    let playbackController: MockPlaybackController
    let controller: AdControllerImpl
    let events: string[]

    const adA: AdInfo = { id: 'a', startTime: 10, duration: 4, uri: null }
    const adB: AdInfo = { id: 'b', startTime: 14, duration: 2, uri: null }

    function stitchedBreak(overrides: Partial<AdBreakInfo> = {}): AdBreakInfo {
        return {
            id: 's1',
            startTime: 10,
            duration: 6,
            placement: 'midroll',
            insertion: 'stitched',
            restrict: {},
            once: false,
            resumeOffset: 6,
            playoutLimit: null,
            resolutionTimeOffset: null,
            skipControl: null,
            ads: [adA, adB],
            ...overrides,
        }
    }

    function createController(
        adBreaks: AdBreakInfo[],
        adBreakResolver?: AdBreakResolver
    ) {
        controller = new AdControllerImpl({
            playbackController,
            ...(adBreakResolver && { adBreakResolver }),
        })
        const track = new MockTrack()
        track.uri = 'content'
        track.getAds = () =>
            Promise.resolve<TrackAds>({ trackUri: 'content', adBreaks })
        controller.setAdsProvider(track)
        return controller
    }

    const RECORDED = [
        'adBreakEntered',
        'adEntered',
        'adPlaying',
        'adFirstQuartile',
        'adMidpoint',
        'adThirdQuartile',
        'adEnded',
        'adCompleted',
        'adBreakCompleted',
    ] as const

    function record() {
        for (const type of RECORDED) {
            controller.on(type, (event: AdEventMap[typeof type]) => {
                const e = event as Partial<AdEventMap['adCompleted']> &
                    Partial<AdEventMap['adBreakCompleted']>
                let entry: string = type
                if (e.ad) entry += `:${e.ad.id}`
                if (e.reason) entry += `:${e.reason}`
                if (type === 'adBreakCompleted') entry += `@${e.resumePosition}`
                events.push(entry)
            })
        }
    }

    /** Lets pending ad discovery and resolution settle. */
    async function flush() {
        for (let i = 0; i < 12; i++) await Promise.resolve()
    }

    function updateTime(time: number) {
        playbackController.currentTime = time
        playbackController.dispatch('timeUpdate', {
            previous: 0,
            current: time,
        })
    }

    function seekTo(time: number) {
        playbackController.dispatch('seeking', {})
        playbackController.currentTime = time
        playbackController.dispatch('seeked', {
            started: 0,
            ended: 0,
            duration: 0,
            reason: 'seeked',
        })
    }

    beforeEach(() => {
        playbackController = new MockPlaybackController()
        playbackController.playing = true
        playbackController.playbackRate = 1
        playbackController.seekTo.and.resolveTo()
        events = []
    })

    afterEach(() => {
        if (!controller.disposed) controller.dispose()
    })

    it('tracks a break as the content plays through it', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        for (let t = 9; t <= 17; t += 0.5) updateTime(t)
        expect(events).toEqual([
            'adBreakEntered',
            'adEntered:a',
            'adPlaying:a',
            'adFirstQuartile:a',
            'adMidpoint:a',
            'adThirdQuartile:a',
            'adEnded:a',
            'adCompleted:a:ended',
            'adEntered:b',
            'adPlaying:b',
            'adFirstQuartile:b',
            'adMidpoint:b',
            'adThirdQuartile:b',
            'adEnded:b',
            'adCompleted:b:ended',
            'adBreakCompleted:ended@16',
        ])
    })

    it('exposes the current break and ad', async () => {
        createController([stitchedBreak()])
        await flush()
        updateTime(15)
        expect(controller.currentAdBreak?.id).toBe('s1')
        expect(controller.currentAd).toBe(adB)
        updateTime(17)
        expect(controller.currentAdBreak).toBeNull()
        expect(controller.currentAd).toBeNull()
    })

    it('emits ad time updates', async () => {
        createController([stitchedBreak({ restrict: { skip: true } })])
        const updates: AdEventMap['adTimeUpdate'][] = []
        controller.on('adTimeUpdate', (event) => updates.push(event))
        await flush()
        updateTime(15)
        expect(updates.at(-1)).toEqual(
            jasmine.objectContaining({
                index: 1,
                totalAds: 2,
                adCurrentTime: 1,
                adTimeRemaining: 1,
                breakCurrentTime: 5,
                breakTimeRemaining: 1,
                canSkip: false,
                skipIn: null,
            })
        )
    })

    it('reports unknown durations', async () => {
        createController([
            stitchedBreak({
                duration: null,
                ads: [{ id: 'a', startTime: 10, duration: null, uri: null }],
            }),
        ])
        const updates: AdEventMap['adTimeUpdate'][] = []
        controller.on('adTimeUpdate', (event) => updates.push(event))
        await flush()
        updateTime(500)
        expect(updates.at(-1)).toEqual(
            jasmine.objectContaining({
                adTimeRemaining: null,
                breakTimeRemaining: null,
                canSkip: true,
            })
        )
    })

    it('waits for playing to report an ad entered while paused', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        playbackController.playing = false
        updateTime(10)
        expect(events).toEqual(['adBreakEntered', 'adEntered:a'])
        playbackController.playing = true
        playbackController.dispatch('playing', {})
        expect(events.at(-1)).toBe('adPlaying:a')
    })

    it('does not report quartiles of an ad entered part way through', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        seekTo(11.8)
        updateTime(13.9)
        expect(events).toEqual([
            'adBreakEntered',
            'adEntered:a',
            'adPlaying:a',
            'adThirdQuartile:a',
        ])
    })

    it('completes ads and the break as skipped when seeking out', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        seekTo(30)
        expect(events).toEqual([
            'adBreakEntered',
            'adEntered:a',
            'adPlaying:a',
            'adCompleted:a:skipped',
            'adBreakCompleted:skipped@30',
        ])
    })

    it('ignores time updates while seeking', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        playbackController.dispatch('seeking', {})
        updateTime(11)
        expect(events).toEqual([])
    })

    it('re-enters a break after seeking back', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        seekTo(5)
        events = []
        updateTime(10)
        expect(events).toEqual(['adBreakEntered', 'adEntered:a', 'adPlaying:a'])
    })

    it('skips the current ad by seeking to its end', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        controller.skipAd()
        expect(playbackController.seekTo).toHaveBeenCalledOnceWith(14)
        // Time updates before the seek lands are ignored.
        updateTime(11.5)
        seekTo(14)
        expect(events.slice(3)).toEqual([
            'adCompleted:a:skipped',
            'adEntered:b',
            'adPlaying:b',
        ])
    })

    it('skips an ad with an unknown duration to the break end', async () => {
        createController([
            stitchedBreak({
                ads: [{ id: 'a', startTime: 10, duration: null, uri: null }],
            }),
        ])
        await flush()
        updateTime(11)
        controller.skipAd()
        expect(playbackController.seekTo).toHaveBeenCalledOnceWith(16)
    })

    it('skips the break by seeking to its end', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        controller.skipAdBreak()
        expect(playbackController.seekTo).toHaveBeenCalledOnceWith(16)
        seekTo(16)
        expect(events.slice(3)).toEqual([
            'adCompleted:a:skipped',
            'adBreakCompleted:skipped@11',
        ])
    })

    it('does not seek to skip a break with an unknown end', async () => {
        createController([stitchedBreak({ duration: null })])
        await flush()
        updateTime(20)
        controller.skipAdBreak()
        expect(playbackController.seekTo).not.toHaveBeenCalled()
        expect(controller.currentAdBreak).toBeNull()
    })

    it('resumes tracking when a skip seek fails', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        playbackController.seekTo.and.rejectWith(new Error('seek failed'))
        controller.skipAd()
        await flush()
        updateTime(11.5)
        expect(events.at(-1)).toBe('adPlaying:a')
    })

    it('does nothing to skip outside a break', async () => {
        createController([stitchedBreak()])
        await flush()
        updateTime(2)
        controller.skipAd()
        controller.skipAdBreak()
        expect(playbackController.seekTo).not.toHaveBeenCalled()
    })

    it('completes the break when content ends within it', async () => {
        createController([stitchedBreak({ placement: 'postroll' })])
        record()
        await flush()
        updateTime(15)
        playbackController.dispatch('ended', {})
        expect(events.slice(-3)).toEqual([
            'adEnded:b',
            'adCompleted:b:ended',
            'adBreakCompleted:ended@16',
        ])
        playbackController.dispatch('ended', {})
        expect(events.length).toBe(7)
    })

    it('resumes at the playhead when content ends in an open-ended break', async () => {
        createController([stitchedBreak({ duration: null })])
        record()
        await flush()
        updateTime(30)
        playbackController.dispatch('ended', {})
        expect(events.at(-1)).toBe('adBreakCompleted:ended@30')
    })

    it('does not enter a roll for a provider that changed meanwhile', async () => {
        createController([
            stitchedBreak({ id: 'pre', startTime: 0, placement: 'preroll' }),
        ])
        const preroll = controller.enterPreroll()
        controller.setAdsProvider(null)
        expect(await preroll).toBeNull()
    })

    it('completes an open-ended ad as skipped when seeking back before it', async () => {
        createController([
            stitchedBreak({
                ads: [{ id: 'late', startTime: 12, duration: null, uri: null }],
            }),
        ])
        record()
        await flush()
        updateTime(13)
        seekTo(11)
        expect(events.slice(-1)).toEqual(['adCompleted:late:skipped'])
        expect(controller.currentAdBreak?.id).toBe('s1')
    })

    it('completes an ad as skipped when the playhead jumps past it', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(10)
        updateTime(15.5)
        expect(events.slice(3)).toEqual([
            'adCompleted:a:skipped',
            'adEntered:b',
            'adPlaying:b',
        ])
    })

    it('ignores ads resolved for a break that was removed', async () => {
        let resolve: (ads: AdInfo[]) => void = () => {}
        const track = new MockTrack()
        track.uri = 'content'
        let adBreaks: AdBreakInfo[] = [
            stitchedBreak({
                ads: () => new Promise<AdInfo[]>((r) => (resolve = r)),
            }),
        ]
        track.getAds = () =>
            Promise.resolve<TrackAds>({ trackUri: 'content', adBreaks })
        controller = new AdControllerImpl({ playbackController })
        controller.setAdsProvider(track)
        record()
        await flush()
        adBreaks = []
        track.dispatch('adsChange', {})
        await flush()
        updateTime(11)
        resolve([adA])
        await flush()
        expect(events).toEqual([])
    })

    it('ignores ads resolved after dispose', async () => {
        let resolve: (ads: AdInfo[]) => void = () => {}
        createController([
            stitchedBreak({
                ads: () => new Promise<AdInfo[]>((r) => (resolve = r)),
            }),
        ])
        record()
        await flush()
        controller.dispose()
        resolve([adA])
        await flush()
        expect(events).toEqual([])
    })

    it('reports no current ad while an interstitial break resolves its ads', async () => {
        createController([
            stitchedBreak({
                id: 'pre',
                startTime: 0,
                placement: 'preroll',
                insertion: 'interstitial',
                ads: () => new Promise<AdInfo[]>(() => {}),
            }),
        ])
        await controller.enterPreroll()
        expect(controller.currentAdBreak?.id).toBe('pre')
        expect(controller.currentAd).toBeNull()
    })

    it('completes the break on a content change', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        controller.setAdsProvider(null)
        expect(events.slice(-2)).toEqual([
            'adCompleted:a:contentChange',
            'adBreakCompleted:contentChange@11',
        ])
    })

    it('keeps the active break across re-reads of equal breaks', async () => {
        const track = new MockTrack()
        track.uri = 'content'
        track.getAds = () =>
            Promise.resolve<TrackAds>({
                trackUri: 'content',
                adBreaks: [stitchedBreak()],
            })
        controller = new AdControllerImpl({ playbackController })
        controller.setAdsProvider(track)
        record()
        await flush()
        updateTime(11)
        track.dispatch('adsChange', {})
        await flush()
        updateTime(11.5)
        expect(events).toEqual(['adBreakEntered', 'adEntered:a', 'adPlaying:a'])
    })

    it('enters a break once its ads resolve', async () => {
        let resolve: (ads: AdInfo[]) => void = () => {}
        createController([
            stitchedBreak({
                ads: () => new Promise<AdInfo[]>((r) => (resolve = r)),
            }),
        ])
        record()
        await flush()
        updateTime(11)
        expect(events).toEqual([])
        resolve([adA])
        await flush()
        expect(events).toEqual(['adBreakEntered', 'adEntered:a', 'adPlaying:a'])
    })

    it('tracks a break whose ads fail to resolve as having no ads', async () => {
        createController([
            stitchedBreak({ ads: () => Promise.reject(new Error('nope')) }),
        ])
        record()
        await flush()
        updateTime(11)
        expect(events).toEqual([])
    })

    it('is not entered as a preroll or postroll interstitial', async () => {
        createController([
            stitchedBreak({ id: 'pre', startTime: 0, placement: 'preroll' }),
            stitchedBreak({ id: 'post', startTime: 50, placement: 'postroll' }),
        ])
        expect(await controller.enterPreroll()).toBeNull()
        expect(await controller.enterPostroll()).toBeNull()
    })

    it('does not fail stitched ads on content errors', async () => {
        createController([stitchedBreak()])
        record()
        await flush()
        updateTime(11)
        controller.failAd(new Error('content error'))
        expect(controller.currentAd).toBe(adA)
    })

    it('ignores playback events while an interstitial plays', async () => {
        createController([
            stitchedBreak(),
            stitchedBreak({
                id: 'i1',
                startTime: 11,
                duration: 1,
                insertion: 'interstitial',
                ads: [{ id: 'i', startTime: 11, duration: 1, uri: 'ad.m3u8' }],
            }),
        ])
        record()
        await flush()
        updateTime(10.5)
        updateTime(11)
        await flush()
        expect(controller.currentAd?.id).toBe('i')
        events = []
        playbackController.currentTime = 0.5
        playbackController.dispatch('playing', {})
        seekTo(0.2)
        playbackController.dispatch('ended', {})
        expect(events).not.toContain('adBreakCompleted:ended@16')
        expect(events).not.toContain('adPlaying:a')
    })

    it('does not emit adPreload for stitched breaks', async () => {
        createController([stitchedBreak()])
        const preload = jasmine.createSpy('adPreload')
        controller.on('adPreload', preload)
        await flush()
        updateTime(5)
        expect(preload).not.toHaveBeenCalled()
    })

    describe('adBreakResolver', () => {
        it('resolves breaks once, sorted by start time', async () => {
            const original = stitchedBreak()
            const resolver = jasmine
                .createSpy<AdBreakResolver>('resolver')
                .and.callFake((adBreak) =>
                    adBreak.id === 's1'
                        ? { ...adBreak, startTime: 20 }
                        : adBreak
                )
            const early = stitchedBreak({ id: 'early', startTime: 15 })
            const track = new MockTrack()
            track.uri = 'content'
            track.getAds = () =>
                Promise.resolve<TrackAds>({
                    trackUri: 'content',
                    adBreaks: [original, early],
                })
            controller = new AdControllerImpl({
                playbackController,
                adBreakResolver: resolver,
            })
            controller.setAdsProvider(track)
            await flush()
            track.dispatch('adsChange', {})
            await flush()
            expect(resolver).toHaveBeenCalledTimes(2)
            expect(resolver).toHaveBeenCalledWith(original, {
                trackUri: 'content',
            })
            expect(
                controller.currentTrackAds?.adBreaks.map((b) => [
                    b.id,
                    b.startTime,
                ])
            ).toEqual([
                ['early', 15],
                ['s1', 20],
            ])
        })

        it('can replace a stitched avail with an interstitial', async () => {
            const vastAd: AdInfo = {
                id: 'vast',
                startTime: 10,
                duration: 6,
                uri: 'https://ads.example.com/ad.m3u8',
            }
            createController([stitchedBreak()], (adBreak) => ({
                ...adBreak,
                insertion: 'interstitial',
                ads: () => Promise.resolve([vastAd]),
            }))
            const entered = jasmine.createSpy('adEntered')
            controller.on('adEntered', entered)
            await flush()
            updateTime(10.5)
            await flush()
            expect(entered).toHaveBeenCalledOnceWith(
                jasmine.objectContaining({ ad: vastAd })
            )
        })

        it('applies to prerolls', async () => {
            createController(
                [
                    stitchedBreak({
                        id: 'pre',
                        startTime: 0,
                        placement: 'preroll',
                    }),
                ],
                (adBreak) => ({ ...adBreak, insertion: 'interstitial' })
            )
            expect((await controller.enterPreroll())?.id).toBe('pre')
        })
    })
})
