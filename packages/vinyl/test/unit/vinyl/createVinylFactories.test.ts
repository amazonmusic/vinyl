/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CapabilitiesImpl,
    createVinylFactories,
    defaultMediaElementPatchOptions,
    defaultPatchOptions,
    type DefaultVinylFactories,
    DrmKeySystem,
    type InferVinylOverrideDependencyType,
    LoudnessNormalizationControllerImpl,
    PlaybackControllerImpl,
    PlaybackSourceImpl,
    TrackControllerImpl,
    type TrackControllerImplOptions,
    type TrackFactory,
    type VinylDeps,
    type VinylTrackLoadOptions,
} from '@amazon/vinyl'
import {
    createContainer,
    type Dependencies,
    type Factories,
} from '@amazon/vinyl-di'
import {
    expectTypeExtends,
    expectTypeStrictlyEquals,
    MockHTMLAudioElement,
    polyfillCustomEvent,
} from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'
import type { AnyRecord } from '@amazon/vinyl-util'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('createVinylFactories', () => {
    const loggerRef = useMockLogger()
    afterEach(() => {
        defaultMediaElementPatchOptions.clear()
    })

    it('delivers all essential dependency providers', () => {
        const playerDependencies = createVinylFactories({
            media: new MockHTMLAudioElement(),
        })
        expect(playerDependencies).toEqual(
            objectContaining({
                playbackController: any(Function),
                playbackSource: any(Function),
                trackController: any(Function),
                capabilities: any(Function),
                loudnessNormalizationController: any(Function),
            })
        )
    })

    it('supplies all crucial dependencies for the Vinyl Player', () => {
        expectTypeExtends<DefaultVinylFactories, Factories<VinylDeps>>(true)
    })

    it('provides options.trackController to the TrackController', () => {
        const playerDependencies: DefaultVinylFactories = createVinylFactories({
            media: new MockHTMLAudioElement(),
            trackController: {
                preloadCapacity: 3,
            },
        })
        const container = createContainer(playerDependencies)
        expect(container.dependencies.trackController.options).toEqual(
            objectContaining<TrackControllerImplOptions>({
                preloadCapacity: 3,
            })
        )
        container.dispose()
    })

    describe('when patch override flags are provided', () => {
        polyfillCustomEvent()
        beforeEach(() => {
            defaultPatchOptions.value = {
                media: {
                    unreliablePlaybackEvents: true,
                    preventStalls: false,
                },
            }
        })

        afterEach(() => {
            defaultPatchOptions.clear()
        })

        it('merges those flags with the defaults', () => {
            const playerDependencies: DefaultVinylFactories =
                createVinylFactories({
                    media: new MockHTMLAudioElement(),
                    patches: {
                        media: {
                            preventStalls: true,
                        },
                    },
                })
            const patched = playerDependencies.patchedMedia()
            expect(loggerRef.value.debug).toHaveBeenCalledWith(
                any(Object),
                `Applying 'preventStalls' patch`
            )
            expect(loggerRef.value.debug).toHaveBeenCalledWith(
                any(Object),
                `Applying 'unreliablePlaybackEvents' patch`
            )
            patched.dispose()
        })
    })

    it('can be used in a dependency container', () => {
        const container = createContainer(
            createVinylFactories({
                media: new MockHTMLAudioElement(),
                drm: {
                    keySystems: {
                        [DrmKeySystem.WIDEVINE as DrmKeySystem]:
                            'https://example.com',
                    },
                },
            })
        )
        expect(container.dependencies).toEqual(
            objectContaining<Dependencies<DefaultVinylFactories>>({
                patchedMedia: any(Object),
                media: any(Object),
                playbackController: any(PlaybackControllerImpl),
                playbackSource: any(PlaybackSourceImpl),
                loudnessNormalizationController: any(
                    LoudnessNormalizationControllerImpl
                ),
                capabilities: any(CapabilitiesImpl),
                requestInterceptor: any(Function),
                trackFactory: any(Object),
                trackController: any(TrackControllerImpl),
                drmKeySystemResolver: any(Function),
                autoResetController: any(Object),
                createDashFactories: any(Function),
            })
        )

        container.dispose()
    })

    describe('InferVinylOverrideDependencyType', () => {
        it('provides the dependency value type for an overridden factory', () => {
            expectTypeStrictlyEquals<
                InferVinylOverrideDependencyType<
                    {
                        playbackSource: () => { a: number }
                    },
                    'playbackSource'
                >,
                { a: number }
            >(true)
        })

        it('provides the dependency value type for default factories', () => {
            expectTypeStrictlyEquals<
                InferVinylOverrideDependencyType<AnyRecord, 'trackFactory'>,
                TrackFactory<VinylTrackLoadOptions>
            >(true)

            expectTypeStrictlyEquals<
                InferVinylOverrideDependencyType<AnyRecord, 'playbackSource'>,
                PlaybackSourceImpl
            >(true)
        })

        it('allows undefined type for overrides', () => {
            expectTypeStrictlyEquals<
                InferVinylOverrideDependencyType<undefined, 'playbackSource'>,
                PlaybackSourceImpl
            >(true)
        })
    })
})
