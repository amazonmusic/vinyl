/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    clone,
    defaultNetworkMetricsControllerImplOptions,
    EMPTY_NETWORK_METRICS_ENTRY,
    EMPTY_SERVICE_METRICS,
    EMPTY_SERVICE_TOTALS,
    EMPTY_STAT_METRICS,
    lerp,
    type NetworkMetrics,
    NetworkMetricsControllerImpl,
    type NetworkMetricsControllerImplOptions,
    type NetworkTransferEntry,
    type StatMetrics,
} from '@amazon/vinyl-util'
import {
    implementEventFakes,
    mockEvent,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    createEventSpy,
    MockNetworkInformation,
    useMockLogger,
} from '@amazon/vinyl-util/testUtil'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('NetworkMetricsControllerImpl', () => {
    let mC: NetworkMetricsControllerImpl
    const mockLoggerRef = useMockLogger()
    const clock = useMockTime()

    beforeEach(() => {
        mC = new NetworkMetricsControllerImpl(
            {},
            {
                unknownDownlinkBandwidthEstimate: 0,
            }
        )
    })

    describe('addMetricsEntry', () => {
        it('updates totals', () => {
            mC.addMetricsEntry(EMPTY_NETWORK_METRICS_ENTRY)
            expect(mC.metrics.totals).toEqual({
                ...EMPTY_SERVICE_METRICS,
                failureTotals: {
                    consecutiveCount: 1,
                    totalCount: 1,
                },
                retryAfter: null,
                successTotals: EMPTY_SERVICE_TOTALS,
            })
            mC.addMetricsEntry(EMPTY_NETWORK_METRICS_ENTRY)
            expect(mC.metrics.totals).toEqual({
                ...EMPTY_SERVICE_METRICS,
                failureTotals: {
                    consecutiveCount: 2,
                    totalCount: 2,
                },
                successTotals: EMPTY_SERVICE_TOTALS,
            })
            mC.addMetricsEntry({
                ...EMPTY_NETWORK_METRICS_ENTRY,
                ok: true,
            })
            expect(mC.metrics.totals).toEqual({
                ...EMPTY_SERVICE_METRICS,
                failureTotals: {
                    consecutiveCount: 0,
                    totalCount: 2,
                },
                successTotals: {
                    consecutiveCount: 1,
                    totalCount: 1,
                },
            })
        })

        describe('when serviceId is not null', () => {
            it('updates service totals', () => {
                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    serviceId: 'a',
                })
                expect(mC.metrics).toEqual({
                    estimatedDownlinkBandwidth: objectContaining<StatMetrics>({
                        dataPoints: 1,
                    }),
                    totals: {
                        ...EMPTY_SERVICE_METRICS,
                        failureTotals: {
                            consecutiveCount: 1,
                            totalCount: 1,
                        },
                    },
                    serviceMetrics: {
                        a: {
                            ...EMPTY_SERVICE_METRICS,
                            failureTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },
                    },
                })
                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    ok: true,
                    serviceId: 'b',
                })

                expect(mC.metrics).toEqual({
                    estimatedDownlinkBandwidth: objectContaining({
                        dataPoints: 1,
                    }),
                    totals: {
                        ...EMPTY_SERVICE_METRICS,
                        failureTotals: {
                            consecutiveCount: 0,
                            totalCount: 1,
                        },
                        successTotals: {
                            consecutiveCount: 1,
                            totalCount: 1,
                        },
                    },
                    serviceMetrics: {
                        a: {
                            ...EMPTY_SERVICE_METRICS,
                            failureTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },

                        b: {
                            ...EMPTY_SERVICE_METRICS,
                            successTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },
                    },
                })

                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    ok: true,
                    serviceId: 'b',
                })

                expect(mC.metrics).toEqual({
                    estimatedDownlinkBandwidth: objectContaining({
                        dataPoints: 1,
                    }),
                    totals: {
                        ...EMPTY_SERVICE_METRICS,
                        failureTotals: {
                            consecutiveCount: 0,
                            totalCount: 1,
                        },
                        successTotals: {
                            consecutiveCount: 2,
                            totalCount: 2,
                        },
                    },
                    serviceMetrics: {
                        a: {
                            ...EMPTY_SERVICE_METRICS,
                            failureTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },

                        b: {
                            ...EMPTY_SERVICE_METRICS,
                            successTotals: {
                                consecutiveCount: 2,
                                totalCount: 2,
                            },
                        },
                    },
                })

                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    ok: true,
                    serviceId: 'c',
                })

                expect(mC.metrics).toEqual({
                    estimatedDownlinkBandwidth: objectContaining({
                        dataPoints: 1,
                    }),
                    totals: {
                        ...EMPTY_SERVICE_METRICS,
                        failureTotals: {
                            consecutiveCount: 0,
                            totalCount: 1,
                        },
                        successTotals: {
                            consecutiveCount: 3,
                            totalCount: 3,
                        },
                    },
                    serviceMetrics: {
                        a: {
                            ...EMPTY_SERVICE_METRICS,
                            failureTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },

                        b: {
                            ...EMPTY_SERVICE_METRICS,
                            successTotals: {
                                consecutiveCount: 2,
                                totalCount: 2,
                            },
                        },

                        c: {
                            ...EMPTY_SERVICE_METRICS,
                            successTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },
                    },
                })

                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    serviceId: 'c',
                })

                expect(mC.metrics).toEqual({
                    estimatedDownlinkBandwidth: objectContaining({
                        dataPoints: 1,
                    }),
                    totals: {
                        ...EMPTY_SERVICE_METRICS,
                        failureTotals: {
                            consecutiveCount: 1,
                            totalCount: 2,
                        },
                        successTotals: {
                            consecutiveCount: 0,
                            totalCount: 3,
                        },
                    },
                    serviceMetrics: {
                        a: {
                            ...EMPTY_SERVICE_METRICS,
                            failureTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                        },

                        b: {
                            ...EMPTY_SERVICE_METRICS,
                            successTotals: {
                                consecutiveCount: 2,
                                totalCount: 2,
                            },
                        },

                        c: {
                            ...EMPTY_SERVICE_METRICS,
                            failureTotals: {
                                consecutiveCount: 1,
                                totalCount: 1,
                            },
                            successTotals: {
                                consecutiveCount: 0,
                                totalCount: 1,
                            },
                        },
                    },
                })
            })

            describe('when retry-after is not null', () => {
                it('sets metrics.retryAfter to the max of current and new value', () => {
                    mC.addMetricsEntry({
                        ...EMPTY_NETWORK_METRICS_ENTRY,
                        retryAfter: 123,
                        serviceId: 'a',
                    })
                    expect(mC.getServiceMetrics('a').retryAfter).toBe(123)

                    mC.addMetricsEntry({
                        ...EMPTY_NETWORK_METRICS_ENTRY,
                        retryAfter: 456,
                        serviceId: 'a',
                    })
                    expect(mC.getServiceMetrics('a').retryAfter).toBe(456)

                    mC.addMetricsEntry({
                        ...EMPTY_NETWORK_METRICS_ENTRY,
                        retryAfter: 1,
                        serviceId: 'a',
                    })
                    expect(mC.getServiceMetrics('a').retryAfter).toBe(456)
                })
            })
        })

        describe('when responseTime is not null', () => {
            it('updates response time metrics', () => {
                const {
                    ewmaSmoothing,
                    ewmaBiasPositiveSmoothing,
                    ewmaBiasNegativeSmoothing,
                } = defaultNetworkMetricsControllerImplOptions

                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    ok: true,
                    responseTime: 2,
                })
                expect(mC.metrics.totals).toEqual({
                    ...EMPTY_SERVICE_METRICS,
                    failureTotals: EMPTY_SERVICE_TOTALS,
                    responseTime: {
                        average: 2,
                        dataPoints: 1,
                        ewma: 2,
                        ewmaHigh: 2,
                        ewmaLow: 2,
                        latest: 2,
                        max: 2,
                        min: 2,
                    },
                    successTotals: {
                        consecutiveCount: 1,
                        totalCount: 1,
                    },
                })
                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    ok: true,
                    responseTime: 4,
                })
                expect(mC.metrics.totals).toEqual({
                    ...EMPTY_SERVICE_METRICS,
                    failureTotals: EMPTY_SERVICE_TOTALS,
                    responseTime: {
                        average: 3,
                        dataPoints: 2,
                        ewma: lerp(2, 4, ewmaSmoothing),
                        ewmaHigh: lerp(2, 4, ewmaBiasPositiveSmoothing),
                        ewmaLow: lerp(2, 4, ewmaBiasNegativeSmoothing),
                        latest: 4,
                        max: 4,
                        min: 2,
                    },
                    successTotals: {
                        consecutiveCount: 2,
                        totalCount: 2,
                    },
                })

                mC.addMetricsEntry({
                    ...EMPTY_NETWORK_METRICS_ENTRY,
                    ok: true,
                })
                expect(mC.metrics.totals).toEqual({
                    ...EMPTY_SERVICE_METRICS,
                    failureTotals: EMPTY_SERVICE_TOTALS,
                    responseTime: {
                        average: 3,
                        dataPoints: 2,
                        ewma: lerp(2, 4, ewmaSmoothing),
                        ewmaHigh: lerp(2, 4, ewmaBiasPositiveSmoothing),
                        ewmaLow: lerp(2, 4, ewmaBiasNegativeSmoothing),
                        latest: 4,
                        max: 4,
                        min: 2,
                    },
                    successTotals: {
                        consecutiveCount: 3,
                        totalCount: 3,
                    },
                })
            })
        })
    })

    describe('getServiceMetrics', () => {
        it('returns the metrics for the given service id, or EMPTY_SERVICE_METRICS if not found', () => {
            mC.addMetricsEntry({
                ...EMPTY_NETWORK_METRICS_ENTRY,
                serviceId: 'a',
            })
            expect(mC.getServiceMetrics('a')).toEqual({
                ...EMPTY_SERVICE_METRICS,
                failureTotals: {
                    consecutiveCount: 1,
                    totalCount: 1,
                },
            })
            expect(mC.getServiceMetrics('b')).toEqual(EMPTY_SERVICE_METRICS)
            mC.addMetricsEntry({
                ...EMPTY_NETWORK_METRICS_ENTRY,
                serviceId: 'a',
            })
            expect(mC.getServiceMetrics('a')).toEqual({
                ...EMPTY_SERVICE_METRICS,
                failureTotals: {
                    consecutiveCount: 2,
                    totalCount: 2,
                },
            })
            // Expect result is cached
            expect(mC.getServiceMetrics('a')).toBe(mC.getServiceMetrics('a'))
        })

        describe('when serviceId is nullish', () => {
            it('returns EMPTY_SERVICE_TOTALS', () => {
                expect(mC.getServiceMetrics(null)).toEqual(
                    EMPTY_SERVICE_METRICS
                )
                expect(mC.getServiceMetrics(undefined)).toEqual(
                    EMPTY_SERVICE_METRICS
                )
            })
        })
    })

    describe('metrics', () => {
        it('is a snapshot at the time it was accessed', () => {
            const initial = mC.metrics
            mC.addMetricsEntry({
                ...EMPTY_NETWORK_METRICS_ENTRY,
                serviceId: 'a',
            })
            const afterFirst = mC.metrics
            mC.addMetricsEntry({
                ...EMPTY_NETWORK_METRICS_ENTRY,
                serviceId: 'a',
            })
            const afterSecond = mC.metrics
            expect(initial).toEqual(
                objectContaining<NetworkMetrics>({
                    serviceMetrics: {},
                    totals: EMPTY_SERVICE_METRICS,
                    estimatedDownlinkBandwidth: objectContaining<StatMetrics>({
                        dataPoints: 1,
                    }),
                })
            )
            expect(afterSecond).not.toEqual(afterFirst)
            expect(mC.metrics).not.toEqual(afterFirst)
            // Expect is cached:
            expect(mC.metrics).toBe(afterSecond)
        })
    })

    describe('addDownlinkTransferEntry', () => {
        it('treats zero-time transfers as a 30 Mbps sample', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 100,
                responseEnd: 100,
                contentEnd: 100,
                serviceId: null,
                bytes: 100,
            })
            await clock.tick(4)
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBe(
                30_000_000
            )
        })

        it('clamps measured bandwidth to 30 Mbps', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 100,
                responseEnd: 100,
                contentEnd: 100.001,
                serviceId: null,
                bytes: 100,
            })
            await clock.tick(4)
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBe(
                30_000_000
            )
        })

        it('ignores entries with zero or negative bytes', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 0,
                responseEnd: 0,
                contentEnd: 1000,
                serviceId: null,
                bytes: 100,
            })
            await clock.tick(4)
            const after = mC.metrics.estimatedDownlinkBandwidth.latest
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 0,
                responseEnd: 0,
                contentEnd: 1000,
                serviceId: null,
                bytes: 0,
            })
            await clock.tick(4)
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBe(after)
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 0,
                responseEnd: 0,
                contentEnd: 1000,
                serviceId: null,
                bytes: -1,
            })
            await clock.tick(4)
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBe(after)
        })

        it('computes bandwidth from trailing 5s window', async () => {
            // Two non-overlapping 1-second transfers of 1000 bytes each
            // Total: 2000 bytes in 2 seconds of transfer time = 8000 bps
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 100,
                responseEnd: 1000,
                contentEnd: 1000,
                serviceId: null,
                bytes: 1000,
            })
            mC.addDownlinkTransferEntry({
                requestStart: 1000,
                responseStart: 1100,
                responseEnd: 2000,
                contentEnd: 2000,
                serviceId: null,
                bytes: 1000,
            })
            await clock.tick(4)
            // Union of [100,1000] and [1100,2000] = 1800ms = 1.8s
            // 2000 bytes * 8 / 1.8 ≈ 8888.89 bps
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBeCloseTo(
                (2000 * 8) / 1.8,
                0
            )
        })

        it('merges overlapping transfer ranges', async () => {
            // Two overlapping transfers
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 100,
                responseEnd: 2000,
                contentEnd: 2000,
                serviceId: null,
                bytes: 500,
            })
            mC.addDownlinkTransferEntry({
                requestStart: 500,
                responseStart: 1000,
                responseEnd: 2000,
                contentEnd: 2000,
                serviceId: null,
                bytes: 500,
            })
            await clock.tick(4)
            // Union of [100,2000] and [1000,2000] = [100,2000] = 1900ms = 1.9s
            // 1000 bytes * 8 / 1.9 ≈ 4210.53 bps
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBeCloseTo(
                (1000 * 8) / 1.9,
                0
            )
        })

        it('batches all entries within the throttle window', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 100,
                responseEnd: 1000,
                contentEnd: 1000,
                serviceId: null,
                bytes: 1000,
            })
            mC.addDownlinkTransferEntry({
                requestStart: 6000,
                responseStart: 6100,
                responseEnd: 7000,
                contentEnd: 7000,
                serviceId: null,
                bytes: 500,
            })
            await clock.tick(4)
            // Both entries are processed together in one batch.
            // Ranges: [100,1000] and [6100,7000] (non-overlapping)
            // Time: (1000-100)/1000 + (7000-6100)/1000 = 0.9 + 0.9 = 1.8s
            // Bytes: 1000 + 500 = 1500
            // BPS: 1500 * 8 / 1.8 ≈ 6666.67
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBeCloseTo(
                (1500 * 8) / 1.8,
                0
            )
        })

        it('estimates responseStart when not provided by resource timing', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: null,
                responseEnd: 1000,
                contentEnd: 1000,
                serviceId: null,
                bytes: 10000,
            })
            await clock.tick(4)
            // estimateResponseStart is used; bandwidth should be computed
            expect(
                mC.metrics.estimatedDownlinkBandwidth.latest
            ).toBeGreaterThan(0)
        })

        it('handles responseEnd <= requestStart with null responseStart', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 1000,
                responseStart: null,
                responseEnd: 1000,
                contentEnd: 1000,
                serviceId: null,
                bytes: 500,
            })
            await clock.tick(4)
            // responseEnd <= requestStart → estimateResponseStart returns requestStart (1000)
            // Range is [1000, 1000] which has 0 duration → time stays at MIN_VALUE
            // bps = bytes*8/MIN_VALUE → clamped to maxMeasuredBandwidthBps
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBe(
                30_000_000
            )
        })

        it('handles contentEnd === requestStart with responseEnd > requestStart', async () => {
            mC.addDownlinkTransferEntry({
                requestStart: 1000,
                responseStart: null,
                responseEnd: 1500,
                contentEnd: 1000,
                serviceId: null,
                bytes: 500,
            })
            await clock.tick(4)
            // responseEnd > requestStart but totalTime (contentEnd - requestStart) is 0
            // estimateResponseStart returns requestStart (1000)
            // Range is [1000, 1000] → 0 duration → clamped to maxMeasuredBandwidthBps
            expect(mC.metrics.estimatedDownlinkBandwidth.latest).toBe(
                30_000_000
            )
        })

        it('emits a metricsChange event', async () => {
            const metricsChangeSpy = createEventSpy(mC, 'metricsChange')
            expect(metricsChangeSpy).not.toHaveBeenCalled()
            mC.addDownlinkTransferEntry({
                requestStart: 0,
                responseStart: 0,
                responseEnd: 0,
                contentEnd: 1000,
                serviceId: null,
                bytes: 1,
            })
            await clock.tick(4)
            expect(metricsChangeSpy).toHaveBeenCalledOnceWith({})
        })

        describe('when log level is verbose', () => {
            it('logs estimatedDownlinkBandwidth', async () => {
                const e: NetworkTransferEntry = {
                    requestStart: 0,
                    responseStart: 0,
                    responseEnd: 0,
                    contentEnd: 1000,
                    serviceId: null,
                    bytes: 1,
                }
                mockLoggerRef.value.verbose.calls.reset()
                mC.addDownlinkTransferEntry(e)
                await clock.tick(4)
                expect(mockLoggerRef.value.verbose).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('estimatedDownlinkBandwidth', () => {
        describe('when networkInformation is undefined', () => {
            describe('and no content transfers have been reported', () => {
                it('seeds with unknownDownlinkBandwidthEstimate', () => {
                    const mC = new NetworkMetricsControllerImpl({})
                    const unknownEstimate =
                        defaultNetworkMetricsControllerImplOptions.unknownDownlinkBandwidthEstimate
                    expect(mC.metrics.estimatedDownlinkBandwidth).toEqual({
                        average: unknownEstimate,
                        dataPoints: 1,
                        ewma: unknownEstimate,
                        ewmaHigh: unknownEstimate,
                        ewmaLow: unknownEstimate,
                        latest: unknownEstimate,
                        max: unknownEstimate,
                        min: unknownEstimate,
                    })
                })

                describe('when unknownDownlinkBandwidthEstimate is provided', () => {
                    const options = {
                        unknownDownlinkBandwidthEstimate: 123,
                    } as const satisfies Partial<NetworkMetricsControllerImplOptions>

                    it('seeds with provided estimate', () => {
                        const mC = new NetworkMetricsControllerImpl({}, options)
                        const expected =
                            options.unknownDownlinkBandwidthEstimate
                        expect(mC.metrics.estimatedDownlinkBandwidth).toEqual({
                            average: expected,
                            dataPoints: 1,
                            ewma: expected,
                            ewmaHigh: expected,
                            ewmaLow: expected,
                            latest: expected,
                            max: expected,
                            min: expected,
                        })
                    })
                })
            })
        })

        describe('when networkInformation is defined', () => {
            const options = {
                unknownDownlinkBandwidthEstimate: 123,
                ewmaSmoothing: 0.2,
                ewmaBiasPositiveSmoothing: 0.5,
                ewmaBiasNegativeSmoothing: 0.1,
                maxMeasuredBandwidthBps: 30_000_000,
                bandwidthEstimationWindow: 4,
            } as const satisfies NetworkMetricsControllerImplOptions
            let networkInformation: MockNetworkInformation
            beforeEach(() => {
                networkInformation = new MockNetworkInformation()
                implementEventFakes(networkInformation)
                networkInformation.downlink = 20 / 1024 / 1024 // mbps
                mC = new NetworkMetricsControllerImpl(
                    {
                        networkInformation,
                    },
                    options
                )
            })

            describe('and networkInformation change event is observed', () => {
                it('updates estimate with new downlink value', async () => {
                    expect(mC.metrics.estimatedDownlinkBandwidth).toEqual({
                        dataPoints: 1,
                        average: 20,
                        ewma: 20,
                        ewmaHigh: 20,
                        ewmaLow: 20,
                        latest: 20,
                        max: 20,
                        min: 20,
                    })

                    networkInformation.downlink = 16 / 1024 / 1024 // mbps
                    const e = mockEvent('change')
                    networkInformation.dispatchEvent(e)
                    expect(mC.metrics.estimatedDownlinkBandwidth).toEqual({
                        dataPoints: 2,
                        average: (20 + 16) / 2,
                        ewma: lerp(20, 16, options.ewmaSmoothing),
                        ewmaHigh: lerp(
                            20,
                            16,
                            options.ewmaBiasNegativeSmoothing
                        ),
                        ewmaLow: lerp(
                            20,
                            16,
                            options.ewmaBiasPositiveSmoothing
                        ),
                        latest: 16,
                        max: 20,
                        min: 16,
                    })

                    const previous = clone(
                        mC.metrics.estimatedDownlinkBandwidth
                    )

                    mC.addDownlinkTransferEntry({
                        requestStart: 0,
                        responseStart: 0,
                        responseEnd: 0,
                        contentEnd: 3000,
                        bytes: 3, // 8 bps
                        serviceId: null,
                    })
                    await clock.tick(4)
                    expect(mC.metrics.estimatedDownlinkBandwidth).toEqual({
                        dataPoints: 3,
                        average: lerp(previous.average, 8, 1 / 3),
                        ewma: lerp(previous.ewma, 8, options.ewmaSmoothing),
                        ewmaHigh: lerp(
                            previous.ewmaHigh,
                            8,
                            options.ewmaBiasNegativeSmoothing
                        ),
                        ewmaLow: lerp(
                            previous.ewmaLow,
                            8,
                            options.ewmaBiasPositiveSmoothing
                        ),
                        latest: 8,
                        max: 20,
                        min: 8,
                    })
                })
            })
        })
    })

    describe('dispose', () => {
        it('removes networkInformation listeners', () => {
            const networkInformation = new MockNetworkInformation()
            const eventFakes = implementEventFakes(networkInformation)
            const mC = new NetworkMetricsControllerImpl({
                networkInformation,
            })
            mC.on('metricsChange', () => {})
            expect(eventFakes.hasAnyListeners()).toBeTrue()
            expect(mC.hasAnyListeners()).toBeTrue()
            mC.dispose()
            expect(eventFakes.hasAnyListeners()).toBeFalse()
            expect(mC.hasAnyListeners()).toBeFalse()
        })
    })

    describe('EMPTY_STAT_METRICS', () => {
        it('is defined', () => {
            expect(EMPTY_STAT_METRICS).toEqual(any(Object))
        })
    })
})
