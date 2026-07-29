/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createHlsFactories,
    type HlsFactoryDeps,
    HlsManifestControllerImpl,
    type HlsManifestProvider,
    MediaSourceControllerImpl,
    QualitySelectorImpl,
} from '@amazon/vinyl'
import { createMockVinylDependencies } from '@amazon/vinyl/vinylTestUtil'
import {
    mockHlsManifestData,
    mockMediaPlaylist,
} from '@amazon/vinyl/vinylTestUtil'
import { createContainer } from '@amazon/vinyl-di'
import {
    MockMediaSource,
    MockMediaSourceGlobal,
} from '@amazon/vinyl-util/browserTestUtil'

import objectContaining = jasmine.objectContaining
import any = jasmine.any
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

describe('createHlsFactories', () => {
    const originalMediaSource = global.MediaSource
    const originalManagedMediaSource = global.ManagedMediaSource
    let hlsFactoryDeps: HlsFactoryDeps
    let manifestProvider: Spy<HlsManifestProvider>

    beforeEach(() => {
        global.ManagedMediaSource = undefined
        global.MediaSource = MockMediaSource as unknown as typeof MediaSource

        const deps = createMockVinylDependencies()
        deps.capabilities.canPlayTypeMse.and.returnValue(true)
        hlsFactoryDeps = deps

        manifestProvider =
            createSpy<HlsManifestProvider>('manifestProvider').and.resolveTo(
                mockHlsManifestData
            )
    })

    afterEach(() => {
        global.MediaSource = originalMediaSource
        global.ManagedMediaSource = originalManagedMediaSource
        MockMediaSourceGlobal.isTypeSupported.calls.reset()
    })

    it('creates factories with external dependencies', () => {
        const factoryCreator = createHlsFactories(null)

        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider,
        })
        const deps = createContainer(factories).dependencies

        expect(deps).toEqual(
            objectContaining<typeof deps>({
                segmentRequestInit: undefined,
                manifestController: any(HlsManifestControllerImpl),
                mediaSourceFactory: any(Function),
                mediaQualityMetadataResolver: any(Function),
                mediaSourceController: any(MediaSourceControllerImpl),
                createContentStreamFactories: any(Function),
                contentStreamFactory: any(Function),
                qualitySelector: any(QualitySelectorImpl),
            })
        )
    })

    it('exposes the shared adController without owning it', () => {
        const factoryCreator = createHlsFactories(null)
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider,
        })
        const container = createContainer(factories)
        // The track resolves the same shared player-level controller.
        expect(container.dependencies.adController).toBe(
            hlsFactoryDeps.adController
        )
        // Disposing the track container must NOT dispose the shared
        // controller (it is an external, non-owned dependency). Otherwise a
        // codec-recovery reloadCurrentTrack would tear down the player-level
        // ad controller.
        const disposeSpy = spyOn(
            hlsFactoryDeps.adController as unknown as { dispose(): void },
            'dispose'
        ).and.callThrough()
        container.dispose()
        expect(disposeSpy).not.toHaveBeenCalled()
    })

    it('provides streaming options to createContentStreamFactories', () => {
        const factoryCreator = createHlsFactories({
            streaming: {
                buffering: {
                    minBuffer: 3.1,
                },
            },
        })

        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider,
        })
        const deps = createContainer(factories).dependencies
        expect(deps.contentStreamFactory('audio')).toEqual(any(Object))
    })

    it('uses createUrlHlsManifestProvider when no manifestProvider given', () => {
        const factoryCreator = createHlsFactories(null)

        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
        })
        const deps = createContainer(factories).dependencies
        expect(deps.manifestController).toEqual(any(HlsManifestControllerImpl))
    })

    it('creates a sidecar text track controller and populates from manifest', async () => {
        const factoryCreator = createHlsFactories(null)
        const subtitleManifest = {
            ...mockHlsManifestData,
            mainPlaylist: {
                ...mockHlsManifestData.mainPlaylist,
                alternativeRenditions: [
                    {
                        type: 'SUBTITLES' as const,
                        groupId: 'subs',
                        name: 'English',
                        language: 'en',
                        uri: 'subs/en.vtt',
                    },
                ],
            },
        }
        const provider =
            createSpy<HlsManifestProvider>('subtitleProvider').and.resolveTo(
                subtitleManifest
            )
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        // Resolve textTrackController first so it subscribes to
        // manifestTransformed before the manifest promise resolves.
        const controller = deps.textTrackController
        await deps.manifestTransformed.value
        await new Promise((r) => setTimeout(r, 0))
        expect(controller).toBeDefined()
        expect(controller.textTracks.length).toBe(1)
        expect(controller.textTracks[0].language).toBe('en')
    })

    it('text track controller swallows manifest fetch errors', async () => {
        const factoryCreator = createHlsFactories(null)
        const provider = createSpy<HlsManifestProvider>(
            'failing'
        ).and.rejectWith(new Error('manifest down'))
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const controller = deps.textTrackController
        // Trigger the transform; the promise will reject but the
        // textTrackController must not throw.
        await deps.manifestTransformed.value.catch(() => undefined)
        await new Promise((r) => setTimeout(r, 0))
        expect(controller.textTracks).toEqual([])
    })

    describe('ad interstitial discovery', () => {
        function interstitialManifest(
            overrides: Partial<typeof mockMediaPlaylist> = {}
        ) {
            const media = {
                ...mockMediaPlaylist,
                dateRanges: [
                    {
                        id: 'ad1',
                        classId: 'com.apple.hls.interstitial',
                        startDate: '2024-01-01T00:00:00.000Z',
                        duration: 5,
                        clientAttributes: {
                            'X-ASSET-URI': 'https://ads.example.com/ad.m3u8',
                        },
                    },
                ],
                ...overrides,
            }
            return {
                ...mockHlsManifestData,
                getMediaPlaylist: () => Promise.resolve(media),
            }
        }

        it('attaches discovered ad breaks to the media timeline', async () => {
            const factoryCreator = createHlsFactories(null)
            const provider = createSpy<HlsManifestProvider>(
                'adProvider'
            ).and.resolveTo(interstitialManifest())
            const factories = factoryCreator(hlsFactoryDeps)({
                uri: 'https://example.com/main.m3u8',
                type: 'hls',
                manifestProvider: provider,
            })
            const deps = createContainer(factories).dependencies
            const timeline = await deps.mediaTimeline.value
            expect(timeline.adBreaks.length).toBe(1)
            expect(timeline.adBreaks[0].id).toBe('ad1')
        })

        it('omits ad breaks when the playlist has none', async () => {
            const factoryCreator = createHlsFactories(null)
            const factories = factoryCreator(hlsFactoryDeps)({
                uri: 'https://example.com/main.m3u8',
                type: 'hls',
                manifestProvider,
            })
            const deps = createContainer(factories).dependencies
            const timeline = await deps.mediaTimeline.value
            expect(timeline.adBreaks).toEqual([])
        })

        it('discovers ads against a live (non-ended) playlist', async () => {
            const factoryCreator = createHlsFactories(null)
            const provider = createSpy<HlsManifestProvider>(
                'liveProvider'
            ).and.resolveTo(interstitialManifest({ ended: false }))
            const factories = factoryCreator(hlsFactoryDeps)({
                uri: 'https://example.com/main.m3u8',
                type: 'hls',
                manifestProvider: provider,
            })
            const deps = createContainer(factories).dependencies
            const timeline = await deps.mediaTimeline.value
            expect(timeline.adBreaks.length).toBe(1)
        })

        it('returns no ad breaks when there are no variants', async () => {
            const factoryCreator = createHlsFactories(null)
            const provider = createSpy<HlsManifestProvider>(
                'noVariants'
            ).and.resolveTo({
                ...mockHlsManifestData,
                mainPlaylist: {
                    ...mockHlsManifestData.mainPlaylist,
                    variants: [],
                },
            })
            const factories = factoryCreator(hlsFactoryDeps)({
                uri: 'https://example.com/main.m3u8',
                type: 'hls',
                manifestProvider: provider,
            })
            const deps = createContainer(factories).dependencies
            const timeline = await deps.mediaTimeline.value
            expect(timeline.adBreaks).toEqual([])
        })

        it('swallows errors from the media playlist fetch during discovery', async () => {
            const factoryCreator = createHlsFactories(null)
            const provider = createSpy<HlsManifestProvider>(
                'throwingMedia'
            ).and.resolveTo({
                ...mockHlsManifestData,
                getMediaPlaylist: () => Promise.reject(new Error('media down')),
            })
            const factories = factoryCreator(hlsFactoryDeps)({
                uri: 'https://example.com/main.m3u8',
                type: 'hls',
                manifestProvider: provider,
            })
            const deps = createContainer(factories).dependencies
            const timeline = await deps.mediaTimeline.value
            expect(timeline.adBreaks).toEqual([])
        })
    })
})
