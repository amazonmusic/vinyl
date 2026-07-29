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
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
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

    it('creates a sidecar text track controller and populates from manifest', async () => {
        const factoryCreator = createDashFactories(null)
        const subtitleManifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" mediaPresentationDuration="PT60S" minBufferTime="PT2S">
  <Period>
    <AdaptationSet contentType="audio" mimeType="audio/mp4" codecs="mp4a.40.2">
      <Representation id="aud" bandwidth="128000"/>
    </AdaptationSet>
    <AdaptationSet contentType="text" mimeType="text/vtt" lang="en">
      <Representation id="en-sub" bandwidth="100">
        <BaseURL>subs/en.vtt</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`
        const manifest = parseDashManifest(subtitleManifestXml)
        const provider = createSpy<DashManifestProvider>(
            'subtitleProvider'
        ).and.resolveTo({
            manifest,
            baseUrl: 'https://example.com/dash/',
        })
        const factories = factoryCreator(dashFactoryDeps)({
            uri: 'test://manifest.mpd',
            type: 'dash',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const ttc = deps.textTrackController
        await deps.manifestTransformed.value
        await new Promise((r) => setTimeout(r, 0))
        expect(ttc).toBeDefined()
        expect(ttc.textTracks.length).toBeGreaterThan(0)
    })

    it('text track controller swallows manifest fetch errors', async () => {
        const factoryCreator = createDashFactories(null)
        const provider = createSpy<DashManifestProvider>(
            'failing'
        ).and.rejectWith(new Error('manifest down'))
        const factories = factoryCreator(dashFactoryDeps)({
            uri: 'test://manifest.mpd',
            type: 'dash',
            manifestProvider: provider,
        })
        const deps = createContainer(factories).dependencies
        const controller = deps.textTrackController
        await deps.manifestTransformed.value.catch(() => undefined)
        await new Promise((r) => setTimeout(r, 0))
        expect(controller.textTracks).toEqual([])
    })
})
