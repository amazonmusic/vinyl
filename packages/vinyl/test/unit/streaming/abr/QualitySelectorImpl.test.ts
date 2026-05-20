/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AbrStrategy,
    createEmptyMediaQualityMetadata,
    defaultQualitySelectorImplOptions,
    type MediaQualityMetadata,
    type PrefetchState,
    QualitySelectorImpl,
    type QualitySelectorImplOptions,
} from '@amazon/vinyl'
import type { Mutable, MutableDeep, NetworkMetrics } from '@amazon/vinyl-util'
import {
    clone,
    EMPTY_NETWORK_METRICS,
    EMPTY_STAT_METRICS,
    networkMetricsController,
} from '@amazon/vinyl-util'
import {
    MockNetworkMetricsController,
    overrideGlobalInit,
} from '@amazon/vinyl-util/testUtil'
import type { MutableValueImpl } from '@amazon/vinyl-observable'
import { data } from '@amazon/vinyl-observable'
import objectContaining = jasmine.objectContaining

describe('QualitySelectorImpl', () => {
    const networkMetricsControllerRef = overrideGlobalInit(
        networkMetricsController,
        () => new MockNetworkMetricsController()
    )
    let metrics: MutableDeep<NetworkMetrics>
    let options: MutableValueImpl<QualitySelectorImplOptions>
    let selector: QualitySelectorImpl
    beforeEach(() => {
        metrics = clone(EMPTY_NETWORK_METRICS)
        metrics.estimatedDownlinkBandwidth.latest = 500 // use ewmaLow for limiter in most tests
        networkMetricsControllerRef.value.metrics = metrics
        options = data<QualitySelectorImplOptions>({
            strategy: AbrStrategy.BEST,
            highBufferThreshold: 50,
            lowBufferThreshold: 30,
            bandwidthMultiplierLow: 1,
            bandwidthMultiplierHigh: 1,
        })
        selector = new QualitySelectorImpl({ options })
    })

    describe('constructor', () => {
        it('uses provided options', () => {
            expect(selector.options).toEqual(objectContaining(options.value))
        })

        it('defaults restrictDecoderChangeOnAudioAbrUp to false', () => {
            expect(
                selector.options.restrictDecoderChangeOnAudioAbrUp
            ).toBeFalse()
        })
    })

    describe('when options change', () => {
        it('merges new options with defaults', () => {
            const options = data<QualitySelectorImplOptions>(
                defaultQualitySelectorImplOptions
            )
            selector = new QualitySelectorImpl({ options })
            options.value = {
                highBufferThreshold: -1,
            }
            expect(selector.options).toEqual({
                ...defaultQualitySelectorImplOptions,
                highBufferThreshold: -1,
            })
        })
    })

    describe('selectQuality', () => {
        const qualities: readonly MediaQualityMetadata[] = [
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 200,
                bandwidthTotal: 200,
                decoderId: '0',
                mimeType: '',
                qualityId: '0',
            },
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 100,
                bandwidthTotal: 100,
                decoderId: '1',
                mimeType: '',
                qualityId: '1',
            },
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 50,
                bandwidthTotal: 50,
                decoderId: '2',
                mimeType: '',
                qualityId: '2',
            },
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 20,
                bandwidthTotal: 20,
                decoderId: '3',
                mimeType: '',
                qualityId: '3',
            },
        ] as const

        describe('when strategy is BEST', () => {
            describe('when prefetchState.previousQuality is null or not in current list', () => {
                let prefetchState: Mutable<PrefetchState>

                beforeEach(() => {
                    prefetchState = {
                        fetchedTime: 0,
                        previousQuality: null,
                        active: false,
                    }
                })

                it('chooses highest quality with bandwidth lower than ewma low estimate', () => {
                    for (const previousQuality of [
                        null,
                        {
                            ...createEmptyMediaQualityMetadata(),
                            bandwidth: 20,
                            bandwidthTotal: 20,
                            decoderId: '3',
                            mimeType: '',
                            qualityId: 'not-in-list',
                        },
                    ] as const satisfies (MediaQualityMetadata | null)[]) {
                        prefetchState.previousQuality = previousQuality
                        metrics.estimatedDownlinkBandwidth =
                            clone(EMPTY_STAT_METRICS)
                        metrics.estimatedDownlinkBandwidth.ewmaLow = 10
                        metrics.estimatedDownlinkBandwidth.latest = 200

                        expect(
                            selector.selectQuality(qualities, prefetchState)
                        ).toEqual(3)

                        metrics.estimatedDownlinkBandwidth.ewmaLow = 200

                        expect(
                            selector.selectQuality(qualities, prefetchState)
                        ).toEqual(0)

                        metrics.estimatedDownlinkBandwidth.latest = 100

                        expect(
                            selector.selectQuality(qualities, prefetchState)
                        ).toEqual(0)
                    }
                })
            })

            describe('when prefetchState.prefetchSegment is in the current quality list', () => {
                let prefetchState: Mutable<PrefetchState>

                const qualities: readonly MediaQualityMetadata[] = [
                    {
                        ...createEmptyMediaQualityMetadata(),
                        bandwidth: 200,
                        bandwidthTotal: 200,
                        contentType: 'audio',
                        decoderId: 'a',
                        mimeType: '',
                        qualityId: '0',
                    },
                    {
                        ...createEmptyMediaQualityMetadata(),
                        bandwidth: 100,
                        bandwidthTotal: 100,
                        contentType: 'audio',
                        decoderId: 'a',
                        mimeType: '',
                        qualityId: '1',
                    },
                    {
                        ...createEmptyMediaQualityMetadata(),
                        bandwidth: 50,
                        bandwidthTotal: 50,
                        contentType: 'audio',
                        decoderId: 'b',
                        mimeType: '',
                        qualityId: '2',
                    },
                    {
                        ...createEmptyMediaQualityMetadata(),
                        bandwidth: 20,
                        bandwidthTotal: 20,
                        contentType: 'audio',
                        decoderId: 'b',
                        mimeType: '',
                        qualityId: '3',
                    },
                ] as const

                beforeEach(() => {
                    prefetchState = {
                        fetchedTime: 0,
                        previousQuality: qualities[1],
                        active: false,
                    }
                })

                describe('and current bandwidthEstimate.low is lower than prefetchState.previousQuality.bandwidth', () => {
                    beforeEach(() => {
                        metrics.estimatedDownlinkBandwidth.ewmaLow = 50
                    })

                    describe('and fetchedTime is greater than highBufferThreshold', () => {
                        beforeEach(() => {
                            prefetchState.fetchedTime = 50
                        })

                        it('returns previous quality', () => {
                            // Enough prefetched, no need to ABR-down yet.
                            expect(
                                selector.selectQuality(qualities, prefetchState)
                            ).toEqual(1)
                        })
                    })

                    describe('and fetchedTime is less than highBufferThreshold', () => {
                        beforeEach(() => {
                            prefetchState.fetchedTime = 49
                        })

                        it('returns lower quality', () => {
                            // Not enough prefetched and not enough bandwidth, ABR down
                            expect(
                                selector.selectQuality(qualities, prefetchState)
                            ).toEqual(2) // bandwidth 50

                            metrics.estimatedDownlinkBandwidth.ewmaLow = 0
                            expect(
                                selector.selectQuality(qualities, prefetchState)
                            ).toEqual(3) // bandwidth 20
                        })
                    })
                })

                describe('and prefetchState.previousQuality.bandwidthTotal is null', () => {
                    it('does not change quality', () => {
                        const qualities2 = clone(qualities)
                        prefetchState.fetchedTime = 0
                        qualities2[1].bandwidthTotal = null
                        prefetchState.previousQuality = qualities2[1]
                        expect(
                            selector.selectQuality(qualities2, prefetchState)
                        ).toEqual(1)
                    })
                })

                describe(`and current bandwidthEstimate.low is higher than next higher bandwidth than previous quality`, () => {
                    beforeEach(() => {
                        // Current is 100
                        metrics.estimatedDownlinkBandwidth.ewmaLow = 200
                    })

                    describe('and fetchedTime is less than lowBufferThreshold', () => {
                        beforeEach(() => {
                            prefetchState.fetchedTime = 29 // lowBufferThreshold = 30
                        })

                        it('does not ABR up', () => {
                            expect(
                                selector.selectQuality(qualities, prefetchState)
                            ).toEqual(1) // Unchanged quality
                        })
                    })

                    describe('and fetchedTime is greater than lowBufferThreshold', () => {
                        beforeEach(() => {
                            prefetchState.fetchedTime = 30 // lowBufferThreshold = 30
                        })

                        describe('and restrictDecoderChangeOnAudioAbrUp is true', () => {
                            beforeEach(() => {
                                options.value = {
                                    ...options.value,
                                    restrictDecoderChangeOnAudioAbrUp: true,
                                }
                            })

                            it('chooses highest quality bandwidth exceeds with same decoderId', () => {
                                // a, a, b, b
                                expect(
                                    selector.selectQuality(
                                        qualities,
                                        prefetchState
                                    )
                                ).toEqual(0)

                                // decoderId 'b'
                                prefetchState.previousQuality = qualities[2]
                                expect(
                                    selector.selectQuality(
                                        qualities,
                                        prefetchState
                                    )
                                ).toEqual(2)

                                prefetchState.previousQuality = qualities[3]
                                expect(
                                    selector.selectQuality(
                                        qualities,
                                        prefetchState
                                    )
                                ).toEqual(2)
                            })
                        })

                        it('restricts to switchingGroupIds when set', () => {
                            const groupA = 'group-a'
                            const groupB = 'group-b'
                            const switchQualities: readonly MediaQualityMetadata[] =
                                [
                                    {
                                        ...createEmptyMediaQualityMetadata(),
                                        bandwidth: 200,
                                        bandwidthTotal: 200,
                                        decoderId: 'a',
                                        qualityId: 'q0',
                                        groupId: groupA,
                                        switchingGroupIds: [groupA],
                                    },
                                    {
                                        ...createEmptyMediaQualityMetadata(),
                                        bandwidth: 100,
                                        bandwidthTotal: 100,
                                        decoderId: 'a',
                                        qualityId: 'q1',
                                        groupId: groupA,
                                        switchingGroupIds: [groupA],
                                    },
                                    {
                                        ...createEmptyMediaQualityMetadata(),
                                        bandwidth: 50,
                                        bandwidthTotal: 50,
                                        decoderId: 'b',
                                        qualityId: 'q2',
                                        groupId: groupB,
                                        switchingGroupIds: [groupB],
                                    },
                                ]
                            // Previous is in groupA, can only switch within groupA
                            prefetchState.previousQuality = switchQualities[1]
                            expect(
                                selector.selectQuality(
                                    switchQualities,
                                    prefetchState
                                )
                            ).toEqual(0)

                            // Previous is in groupB, cannot switch to groupA
                            prefetchState.previousQuality = switchQualities[2]
                            expect(
                                selector.selectQuality(
                                    switchQualities,
                                    prefetchState
                                )
                            ).toEqual(2)
                        })
                    })
                })
            })
        })

        describe('when strategy is LOWEST', () => {
            beforeEach(() => {
                options.value = {
                    ...options.value,
                    strategy: AbrStrategy.LOWEST,
                }
            })

            it('selects last quality', () => {
                expect(
                    selector.selectQuality(qualities, {
                        fetchedTime: 0,
                        previousQuality: null,
                        active: false,
                    })
                ).toEqual(3) // last
            })
        })

        describe('when strategy is HIGHEST', () => {
            beforeEach(() => {
                options.value = {
                    ...options.value,
                    strategy: AbrStrategy.HIGHEST,
                }
            })

            it('selects first quality', () => {
                expect(
                    selector.selectQuality(qualities, {
                        fetchedTime: 0,
                        previousQuality: null,
                        active: false,
                    })
                ).toEqual(0)
            })
        })

        describe('when strategy is FIXED', () => {
            beforeEach(() => {
                options.value = {
                    ...options.value,
                    strategy: AbrStrategy.FIXED,
                }
            })

            describe('and the previous quality is within current list', () => {
                it('selects previous quality', () => {
                    metrics.estimatedDownlinkBandwidth.ewmaLow = 100

                    expect(
                        selector.selectQuality(qualities, {
                            fetchedTime: 0,
                            previousQuality: qualities[0],
                            active: false,
                        })
                    ).toEqual(0)
                })
            })

            describe('and previous quality is null or not within current list', () => {
                it('selects new quality', () => {
                    metrics.estimatedDownlinkBandwidth.ewmaLow = 100

                    expect(
                        selector.selectQuality(qualities, {
                            fetchedTime: 0,
                            previousQuality: null,
                            active: false,
                        })
                    ).toEqual(1)
                })
            })
        })
    })

    describe('when options change', () => {
        it('merges set options with defaults', () => {
            options.value = {
                highBufferThreshold: 32,
            }
            expect(selector.options).toEqual({
                ...defaultQualitySelectorImplOptions,
                highBufferThreshold: 32,
            })
        })
    })

    describe('bandwidthMultiplierLow and bandwidthMultiplierHigh', () => {
        it('uses bandwidthMultiplierLow at fetchedTime 0 and bandwidthMultiplierHigh at highBufferThreshold', () => {
            const testOptions = data<QualitySelectorImplOptions>({
                ...defaultQualitySelectorImplOptions,
                bandwidthMultiplierLow: 0.5,
                bandwidthMultiplierHigh: 0.5,
            })
            selector = new QualitySelectorImpl({ options: testOptions })
            metrics.estimatedDownlinkBandwidth.ewmaLow = 220

            const qualities: readonly MediaQualityMetadata[] = [
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 200,
                    bandwidthTotal: 200,
                },
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 100,
                    bandwidthTotal: 100,
                },
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 50,
                    bandwidthTotal: 50,
                },
            ] as const

            // At fetchedTime 0, effective multiplier is bandwidthMultiplierLow (0.5).
            // 220 * 0.5 = 110, selects quality index 1 (bandwidth 100).
            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 0,
                    previousQuality: null,
                    active: false,
                })
            ).toEqual(1)

            testOptions.value = {
                ...testOptions.value,
                bandwidthMultiplierLow: 1,
                bandwidthMultiplierHigh: 1,
            }
            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 0,
                    previousQuality: null,
                    active: false,
                })
            ).toEqual(0)
        })

        it('interpolates between low and high multiplier based on fetchedTime', () => {
            const testOptions = data<QualitySelectorImplOptions>({
                ...defaultQualitySelectorImplOptions,
                highBufferThreshold: 30,
                bandwidthMultiplierLow: 0.5,
                bandwidthMultiplierHigh: 1.0,
            })
            selector = new QualitySelectorImpl({ options: testOptions })
            metrics.estimatedDownlinkBandwidth.ewmaLow = 220
            metrics.estimatedDownlinkBandwidth.latest = 220

            const qualities: readonly MediaQualityMetadata[] = [
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 200,
                    bandwidthTotal: 200,
                },
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 100,
                    bandwidthTotal: 100,
                },
            ] as const

            // At fetchedTime 0 (active): multiplier = 0.5, bandwidth = 220 * 0.5 = 110 → index 1
            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 0,
                    previousQuality: null,
                    active: true,
                })
            ).toEqual(1)

            // At fetchedTime 30 (active, highBufferThreshold): multiplier = 1.0, bandwidth = 220 → index 0
            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 30,
                    previousQuality: null,
                    active: true,
                })
            ).toEqual(0)

            // At fetchedTime 15 (active, midpoint): lerp(0.5, 1.0, 0.5) = 0.75,
            // bandwidth = 220 * 0.75 = 165 → index 1 (200 > 165)
            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 15,
                    previousQuality: null,
                    active: true,
                })
            ).toEqual(1)
        })

        it('uses bandwidthMultiplierHigh when highBufferThreshold is 0', () => {
            const testOptions = data<QualitySelectorImplOptions>({
                ...defaultQualitySelectorImplOptions,
                highBufferThreshold: 0,
                bandwidthMultiplierLow: 0.1,
                bandwidthMultiplierHigh: 1.0,
            })
            selector = new QualitySelectorImpl({ options: testOptions })
            metrics.estimatedDownlinkBandwidth.ewmaLow = 200

            const qualities: readonly MediaQualityMetadata[] = [
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 200,
                    bandwidthTotal: 200,
                },
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 100,
                    bandwidthTotal: 100,
                },
            ] as const

            // With highBufferThreshold 0, multiplier should be bandwidthMultiplierHigh (1.0).
            // 200 * 1.0 = 200 → index 0
            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 0,
                    previousQuality: null,
                    active: false,
                })
            ).toEqual(0)
        })
    })

    describe('when track is active and latest bandwidth is lower than ewmaLow', () => {
        it('uses latest bandwidth for quality selection', () => {
            metrics.estimatedDownlinkBandwidth.ewmaLow = 150
            metrics.estimatedDownlinkBandwidth.latest = 80

            const qualities: readonly MediaQualityMetadata[] = [
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 100,
                    bandwidthTotal: 100,
                },
                {
                    ...createEmptyMediaQualityMetadata(),
                    bandwidth: 50,
                    bandwidthTotal: 50,
                },
            ] as const

            expect(
                selector.selectQuality(qualities, {
                    fetchedTime: 0,
                    previousQuality: null,
                    active: true,
                })
            ).toEqual(1) // Should select lower quality due to latest bandwidth being 80
        })
    })

    describe('restrictDecoderChangeOnAudioAbrUp', () => {
        const audioQualities: readonly MediaQualityMetadata[] = [
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 200,
                bandwidthTotal: 200,
                contentType: 'audio',
                decoderId: 'a',
                mimeType: '',
                qualityId: '0',
            },
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 100,
                bandwidthTotal: 100,
                contentType: 'audio',
                decoderId: 'b',
                mimeType: '',
                qualityId: '1',
            },
            {
                ...createEmptyMediaQualityMetadata(),
                bandwidth: 50,
                bandwidthTotal: 50,
                contentType: 'audio',
                decoderId: 'c',
                mimeType: '',
                qualityId: '2',
            },
        ] as const

        const prefetchState: PrefetchState = {
            fetchedTime: 30, // >= lowBufferThreshold
            previousQuality: audioQualities[1], // decoder 'b'
            active: false,
        }

        beforeEach(() => {
            // Plenty of bandwidth for the highest audio rendition.
            metrics.estimatedDownlinkBandwidth.ewmaLow = 500
        })

        it('does not cross decoder boundaries when ABR-up is restricted', () => {
            options.value = {
                ...options.value,
                restrictDecoderChangeOnAudioAbrUp: true,
            }
            // Previous decoder is 'b'; ABR-up may only pick qualities with decoder 'b'.
            expect(
                selector.selectQuality(audioQualities, prefetchState)
            ).toEqual(1)
        })

        it('crosses decoder boundaries when restriction is disabled (default)', () => {
            expect(
                selector.options.restrictDecoderChangeOnAudioAbrUp
            ).toBeFalse()
            // With restriction off, the higher-decoder quality is eligible.
            expect(
                selector.selectQuality(audioQualities, prefetchState)
            ).toEqual(0)
        })

        it('still allows ABR-down across decoders regardless of restriction', () => {
            // Force an ABR-down: bandwidth below current quality's bandwidth.
            metrics.estimatedDownlinkBandwidth.ewmaLow = 60
            // fetchedTime must be below highBufferThreshold (50 in this suite).
            const downState: PrefetchState = {
                ...prefetchState,
                fetchedTime: 0,
            }
            for (const restrict of [true, false]) {
                options.value = {
                    ...options.value,
                    restrictDecoderChangeOnAudioAbrUp: restrict,
                }
                // Drops to decoder 'c' (qualityId '2') despite decoder change.
                expect(
                    selector.selectQuality(audioQualities, downState)
                ).toEqual(2)
            }
        })

        it('does not apply to non-audio content', () => {
            const videoQualities: readonly MediaQualityMetadata[] =
                audioQualities.map((q) => ({ ...q, contentType: 'video' }))
            const videoState: PrefetchState = {
                ...prefetchState,
                previousQuality: videoQualities[1],
            }
            // Explicitly enable the restriction; it still shouldn't apply to video.
            options.value = {
                ...options.value,
                restrictDecoderChangeOnAudioAbrUp: true,
            }
            expect(selector.selectQuality(videoQualities, videoState)).toEqual(
                0
            )
        })
    })

    describe('toString', () => {
        it('returns a string', () => {
            expect(selector.toString()).toContain('QualitySelectorImpl')
        })
    })

    describe('dispose', () => {
        it('removes options listeners', () => {
            expect(options.hasAnyListeners()).toBeTrue()
            selector.dispose()
            expect(options.hasAnyListeners()).toBeFalse()
        })
    })

    describe('disposed', () => {
        it('returns true when disposed', () => {
            expect(selector.disposed).toBeFalse()
            selector.dispose()
            expect(selector.disposed).toBeTrue()
        })
    })
})
