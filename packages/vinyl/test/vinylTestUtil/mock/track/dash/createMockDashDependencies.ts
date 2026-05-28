/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentType,
    createEmptyMediaQualityMetadata,
    type DashMediaQualityMetadataResolver,
    type DashTrackDeps,
    type MediaTimeline,
} from '@amazon/vinyl'
import { MockDashManifestController } from '../../dash/MockDashManifestController'
import { MockMediaSourceController } from '../../streaming/buffering/MockMediaSourceController'
import { MockPlaybackSource } from '../../playback/MockPlaybackSource'
import { MockContentStream } from '../../streaming/MockContentStream'
import { MockPlaybackController } from '../../playback/MockPlaybackController'
import { MockDrmController } from '../../drm/MockDrmController'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { data } from '@amazon/vinyl-observable'

import createSpy = jasmine.createSpy

const emptyTimeline: MediaTimeline = { periods: [], minBufferTime: 0 }

const spyFactory = createSpyFactory<DashTrackDeps>()
export function createMockDashDependencies() {
    const playbackController = new MockPlaybackController()
    playbackController.seekTo.and.resolveTo(void 0)

    const manifestController = new MockDashManifestController()

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
        manifestTransformed: manifestController,
        mediaTimeline: data(Promise.resolve(emptyTimeline)),
        mediaTimelineTransformed: data(Promise.resolve(emptyTimeline)),
        mediaSourceController: new MockMediaSourceController(),
        playbackSource: new MockPlaybackSource(),
        playbackController,
        drmController: new MockDrmController(),
        mediaQualityMetadataResolver:
            createSpy<DashMediaQualityMetadataResolver>().and.callFake(() =>
                createEmptyMediaQualityMetadata()
            ),
    } as const satisfies DashTrackDeps
}

export type MockDashDependencies = ReturnType<typeof createMockDashDependencies>
