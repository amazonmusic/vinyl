/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDashFactories,
    type DashFactoryDeps,
    DashManifestControllerImpl,
    type DashManifestProvider,
    MediaSourceControllerImpl,
    pickFirstBaseUrlSelector,
    QualitySelectorImpl,
} from '@amazon/vinyl'
import {
    createMockVinylDependencies,
    mockDashManifest,
} from '@amazon/vinyl/vinylTestUtil'
import { createContainer } from '@amazon/vinyl-di'
import {
    MockMediaSource,
    MockMediaSourceGlobal,
} from '@amazon/vinyl-util/browserTestUtil'
import { clone } from '@amazon/vinyl-util'
import objectContaining = jasmine.objectContaining
import any = jasmine.any
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

describe('createDashFactories', () => {
    const originalMediaSource = global.MediaSource
    const originalManagedMediaSource = global.ManagedMediaSource
    let dashFactoryDeps: DashFactoryDeps
    let manifestProvider: Spy<DashManifestProvider>

    beforeEach(() => {
        // createMediaSource produces a new MediaSource, set mock constructor:
        global.ManagedMediaSource = undefined
        global.MediaSource = MockMediaSource as any

        // Set up dependencies that can be used when creating DashTrackDeps from
        // the factories
        const deps = createMockVinylDependencies()
        deps.capabilities.canPlayTypeMse.and.returnValue(true)
        const manifest = clone(mockDashManifest)
        const adaptationSet = manifest.MPD.Period[0].AdaptationSet![0]
        adaptationSet.mimeType = 'audio/mp4'
        adaptationSet.codecs = 'flac'
        dashFactoryDeps = deps

        manifestProvider = createSpy<DashManifestProvider>(
            'manifestProvider'
        ).and.resolveTo({
            manifest,
            baseUrl: 'https://example.com',
        })
    })

    afterEach(() => {
        global.MediaSource = originalMediaSource
        global.ManagedMediaSource = originalManagedMediaSource
        MockMediaSourceGlobal.isTypeSupported.calls.reset()
    })

    it('creates factories with external dependencies', () => {
        const factoryCreator = createDashFactories(null)

        const factories = factoryCreator(dashFactoryDeps)({
            uri: 'test://manifest.mpd',
            type: 'dash',
            manifestProvider,
        })
        const deps = createContainer(factories).dependencies

        expect(deps).toEqual(
            objectContaining<typeof deps>({
                baseUrlSelector: pickFirstBaseUrlSelector,
                segmentRequestInit: undefined,
                manifestProvider: any(Function),
                manifestController: any(DashManifestControllerImpl),
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
        const factoryCreator = createDashFactories({
            streaming: {
                buffering: {
                    minBuffer: 3.1,
                },
            },
        })

        const factories = factoryCreator(dashFactoryDeps)({
            uri: 'test://manifest.mpd',
            type: 'dash',
            manifestProvider,
        })
        const deps = createContainer(factories).dependencies
        expect(deps.contentStreamFactory('audio')).toEqual(any(Object))
    })
})
