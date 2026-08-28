/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentType,
    createEmptyMediaQualityMetadata,
    defaultQualitySelectorImplOptions,
    type HlsMediaQualityMetadataResolver,
    type HlsTrackDeps,
    type MediaTimeline,
    type VinylOptions,
} from '@amazon/vinyl'
import { MockHlsManifestController } from '../../hls/MockHlsManifestController'
import { MockMediaSourceController } from '../../streaming/buffering/MockMediaSourceController'
import { MockPlaybackSource } from '../../playback/MockPlaybackSource'
import { MockContentStream } from '../../streaming/MockContentStream'
import { MockPlaybackController } from '../../playback/MockPlaybackController'
import { MockDrmController } from '../../drm/MockDrmController'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { data } from '@amazon/vinyl-observable'

import createSpy = jasmine.createSpy

const emptyTimeline: MediaTimeline = {
    periods: [],
    minBufferTime: 0,
    getAdBreaks: () => Promise.resolve([]),
    getDuration: () => Promise.resolve(Infinity),
}

const spyFactory = createSpyFactory<HlsTrackDeps>()
export function createMockHlsDependencies() {
    const playbackController = new MockPlaybackController()
    playbackController.seekTo.and.resolveTo(void 0)

    const manifestController = new MockHlsManifestController()

    return {
        contentTypesValue: data(Promise.resolve(new Set<ContentType>())),
        contentStreamFactory: spyFactory('contentStreamFactory').and.callFake(
            (contentType) => {
                const stream = new MockContentStream()
                stream.contentType = contentType
                return stream
            }
        ),
        manifestController,
        manifestTransformed: manifestController.map((v) => v),
        mediaTimeline: data(Promise.resolve(emptyTimeline)),
        mediaTimelineTransformed: data(Promise.resolve(emptyTimeline)),
        mediaSourceController: new MockMediaSourceController(),
        playbackSource: new MockPlaybackSource(),
        playbackController,
        drmController: new MockDrmController(),
        mediaQualityMetadataResolver:
            createSpy<HlsMediaQualityMetadataResolver>().and.callFake(() =>
                createEmptyMediaQualityMetadata()
            ),
        audio: data<VinylOptions['audio']>({
            selection: { language: null, descriptive: false },
        }),
        allowedContentTypes: data<VinylOptions['allowedContentTypes']>(null),
        abr: data<VinylOptions['abr']>(defaultQualitySelectorImplOptions),
    } as const satisfies HlsTrackDeps
}

export type MockHlsDependencies = ReturnType<typeof createMockHlsDependencies>
