/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type DashFactoryDeps,
    defaultVinylOptions,
    type DrmKeySystemResolver,
    type VinylDeps,
    type VinylOptions,
    type VinylTrackFactoryDeps,
} from '@amazon/vinyl'
import { MockCapabilities } from '../client/MockCapabilities'
import { MockPlaybackController } from '../playback/MockPlaybackController'
import { MockPlaybackSource } from '../playback/MockPlaybackSource'
import { MockTrackController } from '../track/MockTrackController'
import { createMockDashDependencies } from '../track/dash/createMockDashDependencies'
import { MockDrmController } from '../drm/MockDrmController'
import { MockAutoResetController } from '../track/MockAutoResetController'
import { externalDependencies } from '@amazon/vinyl-di'
import { noop } from '@amazon/vinyl-util'
import { data } from '@amazon/vinyl-observable'
import createSpy = jasmine.createSpy

export type MockVinylDependencies = ReturnType<
    typeof createMockVinylDependencies
>

/**
 * Creates mock dependencies for the Vinyl Player and all track factories.
 */
export function createMockVinylDependencies() {
    return {
        options: data<VinylOptions>(defaultVinylOptions),
        trackController: new MockTrackController(),
        playbackSource: new MockPlaybackSource(),
        playbackController: new MockPlaybackController(),
        capabilities: new MockCapabilities(),
        drmController: new MockDrmController(),
        media: createMockMedia(),
        createDashFactories: (_loadOptions) =>
            externalDependencies(createMockDashDependencies()),
        createHlsFactories: (_loadOptions) =>
            externalDependencies(createMockDashDependencies()) as any,
        autoResetController: new MockAutoResetController(),
        requestInterceptor: noop,
        drmKeySystemResolver: createSpy<DrmKeySystemResolver>(
            'drmKeySystemResolver'
        ).and.returnValue([]),
    } as const satisfies VinylDeps & VinylTrackFactoryDeps & DashFactoryDeps
}

function createMockMedia(): HTMLMediaElement {
    return {
        addTextTrack(): TextTrack {
            return {
                cues: { length: 0 } as unknown as TextTrackCueList,
                mode: 'disabled',
                addCue() {},
                removeCue() {},
            } as unknown as TextTrack
        },
    } as unknown as HTMLMediaElement
}
