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
})
