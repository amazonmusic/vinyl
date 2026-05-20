/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDashRepresentationSegmentProvider,
    createDefaultDashMediaQualityMetadataResolver,
    type DashRepresentationSegmentProvider,
    type DashSegmentProviderDeps,
    defaultDrmKeySystemResolver,
    type MediaSegmentReference,
    pickFirstBaseUrlSelector,
    type SegmentDataProvider,
} from '@amazon/vinyl'
import {
    base64ToByteArray,
    clone,
    last,
    type MutableDeep,
    noop,
    requesterWithRetryRef,
    type RequestParams,
    ValidationError,
} from '@amazon/vinyl-util'
import type {
    DashManifest,
    RepresentationType,
    SegmentListType,
    SegmentTemplateType,
} from '@amazon/vinyl-mpd-parser'
import { MockRequester, overrideGlobalInit } from '@amazon/vinyl-util/testUtil'
import { mockDashManifest } from '@amazon/vinyl/vinylTestUtil'
import any = jasmine.any

describe('createDashRepresentationSegmentProvider', () => {
    let baseUrl: string
    let manifest: MutableDeep<DashManifest>
    let representation: MutableDeep<RepresentationType>
    let deps: DashSegmentProviderDeps

    const mockSidxBuffer = base64ToByteArray(
        'AAAAaHNpZHgAAAAAAAAAAQAArEQAAAAAAAAAAAAAAAYAAnl4AAa8AJAAAAAAAnp1AAa8AJAAAAAAAnkNAAa4AJAAAAAAAnqFAAa8AJAAAAAAAnp0AAa8AJAAAAAAAn/TAAa38JAAAAA='
    ).buffer

    const mockRequesterRef = overrideGlobalInit(
        requesterWithRetryRef,
        () => new MockRequester()
    )
    beforeEach(() => {
        deps = {
            requestInterceptor: noop,
            baseUrlSelector: pickFirstBaseUrlSelector,
            segmentRequestInit: undefined,
            mediaQualityMetadataResolver:
                createDefaultDashMediaQualityMetadataResolver({
                    drmKeySystemResolver: defaultDrmKeySystemResolver,
                }),
        }
        manifest = clone(mockDashManifest)
        representation =
            manifest.MPD.Period[0].AdaptationSet![0].Representation![0]

        baseUrl = 'https://example.org'
        representation.codecs = 'flac'
        representation.mimeType = 'audio/mp4'
    })

    /**
     * Clears spied calls to request.
     */
    function clearRequestCalls() {
        mockRequesterRef.value.request.calls.reset()
    }

    function getMostRecentRequestParams(): RequestParams {
        const args = mockRequesterRef.value.request.calls.mostRecent().args
        return {
            input: args[0],
            init: args[1],
            requestOptions: args[2],
        }
    }

    /**
     * Executes the data provider and returns the parameters for the request.
     *
     * @param dataProvider
     */
    async function getDataProviderRequest(
        dataProvider: SegmentDataProvider
    ): Promise<RequestParams> {
        const mockResponse = new Response(new ArrayBuffer(0))
        mockRequesterRef.value.request.and.resolveTo(mockResponse)

        await dataProvider()
        expect(mockRequesterRef.value.request).toHaveBeenCalledTimes(1)
        const args = mockRequesterRef.value.request.calls.mostRecent().args
        clearRequestCalls()
        return {
            input: args[0],
            init: args[1],
            requestOptions: args[2],
        }
    }

    function getRangeHeader(params: RequestParams): string | null {
        const headers = params.init?.headers
        if (!headers) return null
        return (headers as Record<string, string>)['Range']
    }

    /**
     * Collects all segment references for the timeline, mapping the segment data provider to the request it makes.
     * @param timeline
     */
    async function getSegmentRequests(
        timeline: DashRepresentationSegmentProvider
    ): Promise<readonly MediaSegmentReference<RequestParams>[]> {
        let time = 0
        const out: MediaSegmentReference<RequestParams>[] = []
        while (true) {
            const segmentReference = await timeline.getSegment(time)
            if (!segmentReference) break
            const data = await getDataProviderRequest(segmentReference.data)
            out.push({
                startTime: segmentReference.startTime,
                endTime: segmentReference.endTime,
                timestampOffset: segmentReference.timestampOffset,
                data,
            })
            time = segmentReference.endTime
        }
        return out
    }

    /**
     * Performs the mock requests for the init request and all segments, resolving to data describing the init and
     * media segment requests made.
     *
     * @param timeline
     */
    async function getSegmentRequestData(
        timeline: DashRepresentationSegmentProvider
    ) {
        const segmentRequests = await getSegmentRequests(timeline)
        const segmentReference = (await timeline.getSegment(0))!
        const initParams = await getDataProviderRequest(
            segmentReference.initData
        )
        return {
            init: {
                qualityId: segmentReference.quality.qualityId,
                decoderId: segmentReference.quality.decoderId,
                mimeType: segmentReference.quality.mimeType,
                href: initParams.input as string,
                serviceId: initParams.requestOptions?.serviceId,
                range: getRangeHeader(initParams),
            },
            segments: segmentRequests.map((req) => {
                return {
                    startTime: req.startTime,
                    endTime: req.endTime,
                    timestampOffset: req.timestampOffset,
                    href: req.data.input as string,
                    serviceId: req.data.requestOptions?.serviceId,
                    range: getRangeHeader(req.data),
                }
            }),
        }
    }

    function createTimeline() {
        return createDashRepresentationSegmentProvider(
            deps,
            baseUrl,
            representation
        )
    }

    describe('when mimeType cannot be inferred', () => {
        beforeEach(() => {
            delete representation.codecs
            delete representation.mimeType
        })

        it('throws a ValidationError', () => {
            expect(() => createTimeline()).toThrowError(
                ValidationError,
                'mimeType cannot be inferred'
            )
        })
    })

    describe('when representation has neither SegmentList, SegmentTemplate, or SegmentBase', () => {
        it('throws a ValidationError', () => {
            expect(() => createTimeline()).toThrowError(
                ValidationError,
                'Manifest must have one of SegmentList, SegmentTemplate, or SegmentBase'
            )
        })
    })

    describe('when SegmentBase is present', () => {
        beforeEach(() => {
            representation.BaseURL = [
                {
                    _content: 'https://example.com/baseUrl',
                },
            ]
            representation.SegmentBase = {
                indexRangeExact: false,
                indexRange: [344, 678],
                Initialization: {
                    range: [0, 343],
                },
            }
            const mockResponse = new Response(mockSidxBuffer)
            mockRequesterRef.value.request.and.resolveTo(mockResponse)
        })

        it('creates a timeline from an index segment', async () => {
            const timeline = createTimeline()

            await timeline.getSegment(0)
            const request = getMostRecentRequestParams()
            // Expect that the first request is for the index range as defined in the segment base.
            expect(getRangeHeader(request)).toEqual('bytes=344-678')
            expect(request.input).toEqual('https://example.com/baseUrl')
            clearRequestCalls()

            const info = await getSegmentRequestData(timeline)
            expect(info).toEqual({
                init: {
                    qualityId: any(String),
                    decoderId: any(String),
                    mimeType: 'audio/mp4; codecs="flac"',
                    href: 'https://example.com/baseUrl',
                    serviceId: 'example.com',
                    range: 'bytes=0-343',
                },
                segments: [
                    {
                        startTime: 0,
                        endTime: info.segments[1].startTime,
                        timestampOffset: 0,
                        href: 'https://example.com/baseUrl',
                        serviceId: 'example.com',
                        range: 'bytes=679-162846',
                    },
                    {
                        startTime: 10.00780045351474,
                        endTime: info.segments[2].startTime,
                        timestampOffset: info.segments[1].startTime,
                        href: 'https://example.com/baseUrl',
                        serviceId: 'example.com',
                        range: 'bytes=162847-325267',
                    },
                    {
                        startTime: 20.01560090702948,
                        endTime: info.segments[3].startTime,
                        timestampOffset: info.segments[2].startTime,
                        href: 'https://example.com/baseUrl',
                        serviceId: 'example.com',
                        range: 'bytes=325268-487328',
                    },
                    {
                        startTime: 30.00018140589569,
                        endTime: info.segments[4].startTime,
                        timestampOffset: info.segments[3].startTime,
                        href: 'https://example.com/baseUrl',
                        serviceId: 'example.com',
                        range: 'bytes=487329-649765',
                    },
                    {
                        startTime: 40.00798185941043,
                        endTime: info.segments[5].startTime,
                        timestampOffset: info.segments[4].startTime,
                        href: 'https://example.com/baseUrl',
                        serviceId: 'example.com',
                        range: 'bytes=649766-812185',
                    },
                    {
                        startTime: 50.01578231292517,
                        endTime: 60,
                        timestampOffset: info.segments[5].startTime,
                        href: 'https://example.com/baseUrl',
                        serviceId: 'example.com',
                        range: 'bytes=812186-975980',
                    },
                ],
            })
        })

        it('provides initialization from Initialization or SegmentTemplate.initialization', async () => {
            representation.SegmentBase = {
                indexRangeExact: false,
                indexRange: [344, 678],
                Initialization: {
                    sourceURL: 'sourceUrl.mp4',
                },
            }
            const timeline = createTimeline()
            clearRequestCalls()

            const ref = await timeline.getSegment(0)
            clearRequestCalls() // Clear requests made during getSegment (sidx request)
            const initParams = await getDataProviderRequest(ref!.initData)
            expect(initParams.input).toEqual(
                'https://example.com/sourceUrl.mp4'
            )
        })

        describe('when representation is missing segment information', () => {
            beforeEach(() => {
                representation.SegmentBase = {
                    Initialization: {
                        range: [0, 100],
                    },
                    indexRangeExact: false,
                }
            })

            it('throws a ValidationError', async () => {
                await expectAsync(
                    createTimeline().getSegment(0)
                ).toBeRejectedWithError(
                    ValidationError,
                    'Manifest missing segments'
                )
            })
        })

        it('retries sidx segment fetch on next getSegment call when fetch fails', async () => {
            // First call fails
            mockRequesterRef.value.request.and.rejectWith(
                new Error('Network error')
            )
            const timeline = createTimeline()
            // Request is now deferred until getSegment is called
            expect(mockRequesterRef.value.request).toHaveBeenCalledTimes(0)

            await expectAsync(timeline.getSegment(0)).toBeRejected()
            expect(mockRequesterRef.value.request).toHaveBeenCalledTimes(1)

            // Second call succeeds
            const mockResponse = new Response(mockSidxBuffer)
            mockRequesterRef.value.request.and.resolveTo(mockResponse)
            const segment = await timeline.getSegment(0)

            expect(segment).not.toBeNull()
            expect(mockRequesterRef.value.request).toHaveBeenCalledTimes(2)
        })

        describe('when Initialization is not present', () => {
            beforeEach(() => {
                delete representation.SegmentBase?.Initialization
            })

            it('throws a ValidationError', () => {
                expect(() => createTimeline()).toThrowError(
                    ValidationError,
                    'Missing initialization range'
                )
            })
        })
    })

    describe('when SegmentList is defined', () => {
        let segmentList: MutableDeep<SegmentListType>
        beforeEach(() => {
            segmentList = {
                actuate: 'onRequest',
                duration: 100_000, // segment duration
                timescale: 1000,
                indexRangeExact: false,
            }
            representation.SegmentList = segmentList
        })

        describe('when SegmentList.SegmentTimeline is defined', () => {
            beforeEach(() => {
                segmentList.Initialization = {
                    sourceURL: 'init.m3s',
                }
                representation.BaseURL = [
                    {
                        _content: 'https://example.com/baseUrl/',
                    },
                ]
                // First segment sampleTime is 2000, this offset indicates a -1s timestampOffset relative to the MPD
                segmentList.presentationTimeOffset = 3000
                segmentList.SegmentTimeline = {
                    S: [
                        {
                            d: 48000,
                            r: 2,
                            t: 2000,
                        },
                        {
                            d: 49000,
                            r: 0,
                        },
                        {
                            d: 5000,
                            r: 1,
                        },
                    ],
                }
            })

            describe('and SegmentURL is defined', () => {
                beforeEach(() => {
                    segmentList.SegmentURL = [
                        {
                            media: 'segment1.m3s',
                        },
                        {
                            media: 'segment2.m3s',
                        },
                        {
                            media: 'segment3.m3s',
                        },
                        {
                            media: 'segment4.m3s',
                        },
                        {
                            media: 'segment5.m3s',
                        },
                        {
                            media: 'segment6.m3s',
                        },
                    ]
                })

                it('creates a timeline from the S list', async () => {
                    const timeline = createTimeline()
                    representation.id = 'RepId'
                    const info = await getSegmentRequestData(timeline)
                    expect(info).toEqual({
                        init: {
                            qualityId: any(String),
                            decoderId: any(String),
                            mimeType: 'audio/mp4; codecs="flac"',
                            href: 'https://example.com/baseUrl/init.m3s',
                            serviceId: 'example.com',
                            range: null,
                        },
                        segments: [
                            {
                                startTime: 0,
                                endTime: 47,
                                timestampOffset: -1,
                                href: 'https://example.com/baseUrl/segment1.m3s',
                                serviceId: 'example.com',
                                range: null,
                            },
                            {
                                startTime: -1 + 48,
                                endTime: -1 + 48 * 2,
                                timestampOffset: -1 + 48,
                                href: 'https://example.com/baseUrl/segment2.m3s',
                                serviceId: 'example.com',
                                range: null,
                            },
                            {
                                startTime: -1 + 48 * 2,
                                endTime: -1 + 48 * 3,
                                timestampOffset: -1 + 48 * 2,
                                href: 'https://example.com/baseUrl/segment3.m3s',
                                serviceId: 'example.com',
                                range: null,
                            },
                            {
                                startTime: -1 + 48 * 3,
                                endTime: -1 + 48 * 3 + 49,
                                timestampOffset: -1 + 48 * 3,
                                href: 'https://example.com/baseUrl/segment4.m3s',
                                serviceId: 'example.com',
                                range: null,
                            },
                            {
                                startTime: -1 + 48 * 3 + 49,
                                endTime: -1 + 48 * 3 + 49 + 5,
                                timestampOffset: -1 + 48 * 3 + 49,
                                href: 'https://example.com/baseUrl/segment5.m3s',
                                serviceId: 'example.com',
                                range: null,
                            },
                            {
                                startTime: -1 + 48 * 3 + 49 + 5,
                                endTime: -1 + 48 * 3 + 49 + 5 + 5,
                                timestampOffset: -1 + 48 * 3 + 49 + 5,
                                href: 'https://example.com/baseUrl/segment6.m3s',
                                serviceId: 'example.com',
                                range: null,
                            },
                        ],
                    })
                })

                describe('and timescale is not defined', () => {
                    beforeEach(() => {
                        delete representation.SegmentList!.timescale
                    })

                    it('throws a ValidationError', async () => {
                        await expectAsync(
                            createTimeline().getSegment(0)
                        ).toBeRejectedWithError(
                            ValidationError,
                            'invalid timescale'
                        )
                    })
                })
            })

            describe('when SegmentTimeline.S is missing or empty', () => {
                it('provides an empty timeline', async () => {
                    {
                        segmentList.SegmentTimeline!.S!.length = 0
                        segmentList.SegmentURL = []
                        const timeline = createTimeline()
                        expect(await timeline.getSegment(0)).toBeNull()
                    }
                    {
                        delete segmentList.SegmentTimeline!.S
                        segmentList.SegmentURL = []
                        const timeline = createTimeline()
                        expect(await timeline.getSegment(0)).toBeNull()
                    }
                })
            })
        })

        describe('when SegmentURL is set', () => {
            beforeEach(() => {
                segmentList.SegmentURL = []
                representation.BaseURL = [
                    {
                        _content: `https://example.com/media.m4s`,
                    },
                ]
            })

            it('creates segments from the SegmentURL media and mediaRange attributes', async () => {
                manifest.MPD.mediaPresentationDuration = 300 // 100s segments
                segmentList.Initialization = {
                    sourceURL: 'https://example.com/init.mp4',
                }
                {
                    segmentList.SegmentURL = [
                        {
                            mediaRange: [1052, 1699],
                        },
                        {
                            mediaRange: [1700, 1801],
                        },
                        {
                            mediaRange: [1802, 1966],
                        },
                    ]
                    const timeline = createTimeline()
                    const info = await getSegmentRequestData(timeline)
                    expect(info).toEqual({
                        init: {
                            qualityId: any(String),
                            decoderId: any(String),
                            mimeType: 'audio/mp4; codecs="flac"',
                            href: 'https://example.com/init.mp4',
                            serviceId: 'example.com',
                            range: null,
                        },
                        segments: [
                            {
                                startTime: 0,
                                endTime: 100,
                                timestampOffset: 0,
                                href: 'https://example.com/media.m4s',
                                serviceId: 'example.com',
                                range: 'bytes=1052-1699',
                            },
                            {
                                startTime: 100,
                                endTime: 200,
                                timestampOffset: 100,
                                href: 'https://example.com/media.m4s',
                                serviceId: 'example.com',
                                range: 'bytes=1700-1801',
                            },
                            {
                                startTime: 200,
                                endTime: 300,
                                timestampOffset: 200,
                                href: 'https://example.com/media.m4s',
                                serviceId: 'example.com',
                                range: 'bytes=1802-1966',
                            },
                        ],
                    })
                }
            })

            describe('and timescale is not set', () => {
                beforeEach(() => {
                    // Add initialization to pass the immediate validation
                    segmentList.Initialization = {
                        sourceURL: 'init.mp4',
                    }
                })

                it('throws a ValidationError', async () => {
                    delete representation.SegmentList!.timescale
                    await expectAsync(
                        createTimeline().getSegment(0)
                    ).toBeRejectedWithError(
                        ValidationError,
                        'invalid timescale'
                    )
                })
            })

            describe('when SegmentURL list does not span entire period range', () => {
                it('uses period end for end time of last segment', async () => {
                    // https://jira.music.amazon.dev/browse/PLAYBACK-6131
                    manifest.MPD.mediaPresentationDuration = 320 // 100s segments
                    segmentList.Initialization = {
                        sourceURL: 'https://example.com/init.mp4',
                    }
                    {
                        segmentList.SegmentURL = [
                            {
                                mediaRange: [0, 0],
                            },
                            {
                                mediaRange: [0, 0],
                            },
                            {
                                mediaRange: [0, 0],
                            },
                        ]
                        const timeline = createTimeline()
                        const info = await getSegmentRequestData(timeline)
                        expect(info.segments.length).toBe(3)
                        expect(last(info.segments)?.startTime).toBe(200)
                        expect(last(info.segments)?.endTime).toBe(320)
                    }
                })
            })
        })

        describe('when SegmentList.href is set', () => {
            beforeEach(() => {
                segmentList.href = 'set'
                // Add initialization to pass the immediate validation
                segmentList.Initialization = {
                    sourceURL: 'init.mp4',
                }
            })

            it('is not supported', async () => {
                await expectAsync(
                    createTimeline().getSegment(0)
                ).toBeRejectedWithError(
                    ValidationError,
                    'SegmentList.href currently unsupported'
                )
            })
        })

        describe('when SegmentURL is not set', () => {
            beforeEach(() => {
                // Add initialization to pass the immediate validation
                segmentList.Initialization = {
                    sourceURL: 'init.mp4',
                }
            })

            it('throws a ValidationError', async () => {
                await expectAsync(
                    createTimeline().getSegment(0)
                ).toBeRejectedWithError(
                    ValidationError,
                    'could not determine segments from SegmentList'
                )
            })
        })
    })

    describe('when SegmentTemplate is defined', () => {
        let segmentTemplate: MutableDeep<SegmentTemplateType>
        beforeEach(() => {
            segmentTemplate = {
                indexRangeExact: false,
            }
            representation.SegmentTemplate = segmentTemplate
        })

        describe('when SegmentTemplate.media is not defined', () => {
            beforeEach(() => {
                // Add initialization to pass the immediate validation
                segmentTemplate.initialization = 'init.mp4'
            })

            it('throws a ValidationError', async () => {
                await expectAsync(
                    createTimeline().getSegment(0)
                ).toBeRejectedWithError(
                    ValidationError,
                    'SegmentTemplate.media required'
                )
            })
        })

        describe('when SegmentTemplate.timescale is not defined', () => {
            beforeEach(() => {
                segmentTemplate.media = 'template'
                // Add initialization to pass the immediate validation
                segmentTemplate.initialization = 'init.mp4'
            })

            it('throws a ValidationError', async () => {
                await expectAsync(
                    createTimeline().getSegment(0)
                ).toBeRejectedWithError(ValidationError, 'invalid timescale')
            })
        })

        describe('when SegmentTemplate.SegmentTimeline is defined', () => {
            beforeEach(() => {
                representation.id = 'MyRepId'
                segmentTemplate.media = '$RepresentationID$_$Number$.m3s'
                segmentTemplate.initialization = '$RepresentationID$_init.m3s'
                segmentTemplate.timescale = 1000

                segmentTemplate.SegmentTimeline = {
                    S: [
                        {
                            d: 6000,
                            r: 1,
                        },
                        {
                            d: 49000,
                            r: 0,
                        },
                    ],
                }
            })

            it('creates a timeline using the template url', async () => {
                const info = await getSegmentRequestData(createTimeline())
                expect(info).toEqual({
                    init: {
                        qualityId: any(String),
                        decoderId: any(String),
                        mimeType: 'audio/mp4; codecs="flac"',
                        href: 'https://example.org/MyRepId_init.m3s',
                        serviceId: 'example.org',
                        range: null,
                    },
                    segments: [
                        {
                            startTime: 0,
                            endTime: 6,
                            timestampOffset: 0,
                            href: 'https://example.org/MyRepId_1.m3s',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 6,
                            endTime: 12,
                            timestampOffset: 6,
                            href: 'https://example.org/MyRepId_2.m3s',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 12,
                            endTime: 61,
                            timestampOffset: 12,
                            href: 'https://example.org/MyRepId_3.m3s',
                            serviceId: 'example.org',
                            range: null,
                        },
                    ],
                })
            })
        })

        describe('when SegmentTemplate.duration is defined', () => {
            beforeEach(() => {
                manifest.MPD.mediaPresentationDuration = 45
                segmentTemplate.duration = 10000
                segmentTemplate.timescale = 1000
                segmentTemplate.media = '$Time%05d$.m4s'
                segmentTemplate.initialization = 'init.mp4'
            })

            it('creates a fixed timeline from segment duration', async () => {
                const info = await getSegmentRequestData(createTimeline())
                expect(info).toEqual({
                    init: {
                        qualityId: any(String),
                        decoderId: any(String),
                        mimeType: 'audio/mp4; codecs="flac"',
                        href: 'https://example.org/init.mp4',
                        serviceId: 'example.org',
                        range: null,
                    },
                    segments: [
                        {
                            startTime: 0,
                            endTime: 10,
                            timestampOffset: 0,
                            href: 'https://example.org/00000.m4s',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 10,
                            endTime: 20,
                            timestampOffset: 10,
                            href: 'https://example.org/10000.m4s',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 20,
                            endTime: 30,
                            timestampOffset: 20,
                            href: 'https://example.org/20000.m4s',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 30,
                            endTime: 40,
                            timestampOffset: 30,
                            href: 'https://example.org/30000.m4s',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 40,
                            endTime: 45,
                            timestampOffset: 40,
                            href: 'https://example.org/40000.m4s',
                            serviceId: 'example.org',
                            range: null,
                        },
                    ],
                })
            })

            describe('when period end time cannot be determined', () => {
                beforeEach(() => {
                    delete manifest.MPD.mediaPresentationDuration
                })

                it('throws a validation error', async () => {
                    await expectAsync(
                        createTimeline().getSegment(0)
                    ).toBeRejectedWithError(
                        ValidationError,
                        'MPD.mediaPresentationDuration or Period.duration required'
                    )
                })
            })
        })

        describe('when neither SegmentTemplate.SegmentTimeline or SegmentTemplate.duration is defined', () => {
            beforeEach(() => {
                segmentTemplate.media = '$RepresentationID$_$Number$.m3s'
                segmentTemplate.initialization = '$RepresentationID$_init.m3s'
                segmentTemplate.timescale = 1000
            })

            it('throws a ValidationError', async () => {
                await expectAsync(
                    createTimeline().getSegment(0)
                ).toBeRejectedWithError(ValidationError, 'invalid duration')
            })
        })

        describe('when SegmentTemplate is inherited from AdaptationSet', () => {
            beforeEach(() => {
                // timescale and duration at AdaptationSet level
                const adaptationSet = representation.parent
                adaptationSet.SegmentTemplate = {
                    timescale: 90000,
                    duration: 180000,
                    startNumber: 1,
                    indexRangeExact: false,
                }
                // media and initialization at Representation level
                representation.id = '1'
                representation.SegmentTemplate = {
                    media: 'DashTest3_1080p_$Number%09d$.mp4',
                    initialization: 'DashTest3_1080pinit.mp4',
                    duration: 180000,
                    startNumber: 1,
                    indexRangeExact: false,
                }
                representation.codecs = 'avc1.640028'
                representation.mimeType = 'video/mp4'
                manifest.MPD.mediaPresentationDuration = 4
            })

            it('merges AdaptationSet and Representation SegmentTemplate properties', async () => {
                const info = await getSegmentRequestData(createTimeline())
                expect(info).toEqual({
                    init: {
                        qualityId: any(String),
                        decoderId: any(String),
                        mimeType: 'video/mp4; codecs="avc1.640028"',
                        href: 'https://example.org/DashTest3_1080pinit.mp4',
                        serviceId: 'example.org',
                        range: null,
                    },
                    segments: [
                        {
                            startTime: 0,
                            endTime: 2,
                            timestampOffset: 0,
                            href: 'https://example.org/DashTest3_1080p_000000001.mp4',
                            serviceId: 'example.org',
                            range: null,
                        },
                        {
                            startTime: 2,
                            endTime: 4,
                            timestampOffset: 2,
                            href: 'https://example.org/DashTest3_1080p_000000002.mp4',
                            serviceId: 'example.org',
                            range: null,
                        },
                    ],
                })
            })
        })
    })
})
