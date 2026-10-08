/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CapabilitiesImpl,
    createVinylFactories,
    type DefaultVinylFactories,
    DrmKeySystem,
    type InferVinylOverrideDependencyType,
    LoudnessNormalizationControllerImpl,
    mediaKeySupportRef,
    PlaybackControllerImpl,
    PlaybackSourceImpl,
    StandardCommonEme,
    TrackControllerImpl,
    type TrackControllerImplOptions,
    type TrackFactory,
    type VinylDeps,
    type VinylTrackLoadOptions,
    WebKitCommonEme,
} from '@amazon/vinyl'
import { overrideGlobalInit } from '@amazon/vinyl-util/testUtil'
import {
    createContainer,
    type Dependencies,
    type Factories,
} from '@amazon/vinyl-di'
import {
    expectTypeExtends,
    expectTypeStrictlyEquals,
    MockHTMLAudioElement,
} from '@amazon/vinyl-util/browserTestUtil'
import type { AnyRecord } from '@amazon/vinyl-util'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('createVinylFactories', () => {
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
                media: any(Object),
                textTrackProvider: any(Object),
                textTrackRenderer: null,
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

    describe('commonEme', () => {
        overrideGlobalInit(mediaKeySupportRef, () => ({
            standardEme: true,
            webkitEme: true,
            msEme: false,
        }))

        function createCommonEme(
            drm?: Parameters<typeof createVinylFactories>[0]['drm']
        ) {
            const container = createContainer(
                createVinylFactories({
                    media: new MockHTMLAudioElement(),
                    ...(drm && { drm }),
                })
            )
            const commonEme = container.dependencies.commonEme
            container.dispose()
            return commonEme
        }

        it('prefers standard EME by default', () => {
            expect(createCommonEme()).toBeInstanceOf(StandardCommonEme)
            expect(createCommonEme({})).toBeInstanceOf(StandardCommonEme)
        })

        it('prefers standard EME when drm.preferPrefixedMediaKeys is false or null', () => {
            expect(
                createCommonEme({ preferPrefixedMediaKeys: false })
            ).toBeInstanceOf(StandardCommonEme)
            expect(
                createCommonEme({ preferPrefixedMediaKeys: null })
            ).toBeInstanceOf(StandardCommonEme)
        })

        it('prefers prefixed EME when drm.preferPrefixedMediaKeys is true', () => {
            expect(
                createCommonEme({ preferPrefixedMediaKeys: true })
            ).toBeInstanceOf(WebKitCommonEme)
        })
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
