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
import { mockHlsManifestData } from '@amazon/vinyl/vinylTestUtil'
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

    it('creates an ad controller and discovers HLS interstitials', async () => {
        const factoryCreator = createHlsFactories(null)
        const mediaPlaylist = {
            version: 7,
            targetDuration: 6,
            mediaSequence: 0,
            playlistType: 'VOD' as const,
            ended: true,
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 30,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
            ],
            dateRanges: [
                {
                    id: 'ad1',
                    classId: 'com.apple.hls.interstitial',
                    startDate: '2024-01-01T00:00:10.000Z',
                    duration: 5,
                    clientAttributes: { 'X-ASSET-URI': 'ads/ad.m3u8' },
                },
            ],
        }
        const adManifest = {
            ...mockHlsManifestData,
            getMediaPlaylist: () => Promise.resolve(mediaPlaylist),
        }
        const provider =
            createSpy<HlsManifestProvider>('adProvider').and.resolveTo(
                adManifest
            )
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const controller = deps.adController
        await deps.manifestTransformed.value
        await new Promise((r) => setTimeout(r, 0))
        expect(controller).toBeDefined()
        expect(controller.adBreaks.length).toBe(1)
        expect(controller.adBreaks[0].id).toBe('ad1')
        expect(controller.adBreaks[0].startTime).toBe(10)
        // The X-ASSET-URI is resolved against the variant media playlist URL.
        expect(controller.adBreaks[0].ads[0].uri).toMatch(
            /^https:\/\/example\.com\/.*ads\/ad\.m3u8$/
        )
    })

    it('discovers interstitials from a live (non-ended) media playlist', async () => {
        const factoryCreator = createHlsFactories(null)
        const liveMediaPlaylist = {
            version: 7,
            targetDuration: 6,
            mediaSequence: 0,
            playlistType: 'LIVE' as const,
            ended: false,
            segments: [
                {
                    uri: 'seg0.ts',
                    duration: 6,
                    sequenceNumber: 0,
                    discontinuity: false,
                    programDateTime: '2024-01-01T00:00:00.000Z',
                },
            ],
            dateRanges: [
                {
                    id: 'live-ad',
                    classId: 'com.apple.hls.interstitial',
                    startDate: '2024-01-01T00:00:03.000Z',
                    duration: 5,
                    clientAttributes: {},
                },
            ],
        }
        const provider = createSpy<HlsManifestProvider>(
            'liveProvider'
        ).and.resolveTo({
            ...mockHlsManifestData,
            getMediaPlaylist: () => Promise.resolve(liveMediaPlaylist),
        })
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const controller = deps.adController
        await deps.manifestTransformed.value
        await new Promise((r) => setTimeout(r, 0))
        expect(controller.adBreaks.length).toBe(1)
        expect(controller.adBreaks[0].id).toBe('live-ad')
    })

    it('ad controller ignores a main playlist with no variants', async () => {
        const factoryCreator = createHlsFactories(null)
        const noVariantManifest = {
            ...mockHlsManifestData,
            mainPlaylist: {
                ...mockHlsManifestData.mainPlaylist,
                variants: [],
            },
            getMediaPlaylist: createSpy('getMediaPlaylist'),
        }
        const provider =
            createSpy<HlsManifestProvider>('noVariantProvider').and.resolveTo(
                noVariantManifest
            )
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const controller = deps.adController
        await deps.manifestTransformed.value
        await new Promise((r) => setTimeout(r, 0))
        expect(controller.adBreaks).toEqual([])
        expect(noVariantManifest.getMediaPlaylist).not.toHaveBeenCalled()
    })

    it('ad controller swallows manifest fetch errors', async () => {
        const factoryCreator = createHlsFactories(null)
        const provider = createSpy<HlsManifestProvider>(
            'failingAd'
        ).and.rejectWith(new Error('manifest down'))
        const factories = factoryCreator(hlsFactoryDeps)({
            uri: 'https://example.com/main.m3u8',
            type: 'hls',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const controller = deps.adController
        await deps.manifestTransformed.value.catch(() => undefined)
        await new Promise((r) => setTimeout(r, 0))
        expect(controller.adBreaks).toEqual([])
    })
})
