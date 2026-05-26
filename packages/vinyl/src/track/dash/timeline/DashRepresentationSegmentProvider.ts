/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe, MaybePromise } from '@amazon/vinyl-util'
import {
    ErrorOrigin,
    getSidxSampleTimes,
    parseSidxBox,
    ValidationError,
} from '@amazon/vinyl-util'
import type {
    ByteRange,
    MultipleSegmentBaseType,
    RepresentationType,
    SegmentBaseType,
    SegmentListType,
    SegmentTemplateType,
    SegmentTimelineType,
} from '@amazon/vinyl-mpd-parser'
import {
    calculatePeriodTimeRange,
    getSegmentBase,
    getSegmentList,
    getSegmentTemplate,
    type PeriodRange,
    sampleToMpdTime,
} from '@/track/dash/util/mpd'
import {
    type DashUriResolveDeps,
    resolveDashUri,
    segmentTemplateUrl,
} from '@/track/dash/util/uriResolution'
import {
    createSegmentDataProvider,
    type CreateSegmentDataProviderDeps,
} from '@/track/createSegmentDataProvider'
import { getSegmentAtTime } from '@/streaming/util/segment'
import type {
    MediaSegmentReference,
    SegmentReference,
} from '@/streaming/SegmentReference'
import type { SegmentDataProvider } from '@/streaming/SegmentDataSlot'
import type { MediaQualityMetadata } from '@/streaming/MediaQualityMetadata'
import type { DashMediaQualityMetadataResolver } from '@/track/dash/DashMediaQualityMetadataResolver'

export interface DashSegmentProviderDeps
    extends DashUriResolveDeps, CreateSegmentDataProviderDeps {
    /**
     * Produces abstract metadata from a dash representation.
     */
    readonly mediaQualityMetadataResolver: DashMediaQualityMetadataResolver
}

export interface DashRepresentationSegmentProvider {
    /**
     * Gets a segment reference within this representation for the given time, in seconds, relative to the period.
     *
     * @param time
     * @param affordance Forward-snap tolerance in seconds: if `time` falls just before a
     * segment's start (within `affordance`), that segment is returned. Defaults to `0`.
     */
    getSegment(
        time: number,
        affordance?: number
    ): Promise<SegmentReference<SegmentDataProvider> | null>
}

interface GetTimelineOptions {
    readonly baseUrl: string
    readonly representation: RepresentationType
    readonly periodTimeRange: PeriodRange
}

/**
 * Metadata and a data provider for a segment.
 */
type DataSegmentRef = MediaSegmentReference<SegmentDataProvider>

/**
 * Creates a representation timeline for the given representation.
 */
export function createDashRepresentationSegmentProvider(
    deps: DashSegmentProviderDeps,
    baseUrl: string,
    representation: RepresentationType
): DashRepresentationSegmentProvider {
    const quality: MediaQualityMetadata =
        deps.mediaQualityMetadataResolver(representation)
    const options: GetTimelineOptions = {
        baseUrl,
        periodTimeRange: calculatePeriodTimeRange(representation.parent.parent),
        representation,
    }

    // 5.3.9.1 General
    // The elements SegmentBase, SegmentTemplate and SegmentList may be present in the
    // Representation element itself. In addition, to express default values, they may be present in the
    // Period and AdaptationSet element. At each level at most one of the three, SegmentBase,
    // SegmentTemplate and SegmentList, shall be present. Further, if SegmentTemplate or SegmentList is present on
    // one level of the hierarchy, then the other one shall not be present on any lower hierarchy level.

    const segmentTemplate = getSegmentTemplate(representation)
    const segmentList = getSegmentList(representation)
    const segmentBase = getSegmentBase(representation)

    let segmentsPromise: MaybePromise<
        readonly MediaSegmentReference<SegmentDataProvider>[]
    > | null = null

    let initUri: Maybe<string>
    let initRange: Maybe<ByteRange>

    if (segmentTemplate?.initialization) {
        initUri = segmentTemplateUrl(segmentTemplate.initialization, {
            representation,
        })
    }

    const commonSegmentBase = segmentTemplate ?? segmentList ?? segmentBase
    if (!commonSegmentBase)
        throw new ValidationError(
            'Manifest must have one of SegmentList, SegmentTemplate, or SegmentBase',
            ErrorOrigin.MEDIA
        )

    if (commonSegmentBase.Initialization) {
        initUri = commonSegmentBase.Initialization.sourceURL
        initRange = commonSegmentBase.Initialization.range
    }

    if (!initUri && !initRange)
        throw new ValidationError(
            'Missing initialization range',
            ErrorOrigin.MEDIA
        )

    const { url: initUrl, serviceLocation: initServiceLocation } =
        resolveDashUri(deps, { baseUrl, representation, uri: initUri })
    const initData = createSegmentDataProvider(deps, {
        url: initUrl,
        mediaRange: initRange,
        serviceId: initServiceLocation,
        reportDownlinkMetrics: false,
    })

    let getSegmentReferences: () => MaybePromise<
        readonly MediaSegmentReference<SegmentDataProvider>[]
    >

    // If an index range is present, use that to calculate segment data.
    // The index location may be defined in several locations:
    // SegmentBase.indexRange, SegmentBase.RepresentationIndex, or SegmentTemplate.index
    // One of segmentList, segmentTemplate, or segmentBase is guaranteed to be set.
    if (segmentList) {
        getSegmentReferences = () =>
            createSegmentsFromSegmentList(deps, {
                ...options,
                segmentList,
            })
    } else if (segmentTemplate) {
        getSegmentReferences = () =>
            createSegmentsFromSegmentTemplate(deps, {
                ...options,
                segmentTemplate,
            })
    } else if (segmentBase) {
        getSegmentReferences = () =>
            createSegmentsFromSegmentBase(deps, {
                ...options,
                segmentBase,
            })
    }

    return {
        async getSegment(
            time: number,
            affordance = 0
        ): Promise<SegmentReference<SegmentDataProvider> | null> {
            if (!segmentsPromise) segmentsPromise = getSegmentReferences()
            const segments = await Promise.resolve(segmentsPromise).catch(
                (error) => {
                    // When the segments list fails (for example the sidx range request fails),
                    // retry on the next request.
                    segmentsPromise = null
                    throw error
                }
            )
            const segment = getSegmentAtTime(time, segments, affordance)
            if (!segment) return null
            return {
                quality,
                ...segment,
                initData,
            }
        },
    }
}

/**
 * Creates a segment list when the representation has a SegmentList.
 */
function createSegmentsFromSegmentList(
    deps: DashSegmentProviderDeps,
    options: GetTimelineOptions & {
        readonly segmentList: SegmentListType
    }
): readonly DataSegmentRef[] {
    const { baseUrl, periodTimeRange, representation, segmentList } = options
    const segmentUrls = segmentList.SegmentURL
    if (segmentUrls) {
        // Fabricate a segment timeline from the segment duration.
        const timescale = getTimescale(segmentList)
        const sampleTimes = calculateSegmentSampleTimes({
            multipleSegmentBase: segmentList,
            periodTimeRange,
            numSegments: segmentUrls.length,
        })
        const presentationTimeOffset = segmentList.presentationTimeOffset ?? 0

        return createTimeline(
            {
                sampleTimes,
                presentationTimeOffset,
                periodTimeRange,
                timescale,
            },
            (i) => {
                const segmentUrl = segmentUrls[i]
                const { url, serviceLocation } = resolveDashUri(deps, {
                    baseUrl,
                    uri: segmentUrl.media,
                    representation,
                })
                return createSegmentDataProvider(deps, {
                    url,
                    mediaRange: segmentUrl.mediaRange,
                    serviceId: serviceLocation,
                    reportDownlinkMetrics: true,
                })
            }
        )
    } else {
        if (segmentList.href) {
            throw new ValidationError(
                'SegmentList.href currently unsupported',
                ErrorOrigin.MEDIA
            )
        } else {
            throw new ValidationError(
                'could not determine segments from SegmentList',
                ErrorOrigin.MEDIA
            )
        }
    }
}

/**
 * SegmentTemplate contains URIs with template tokens, as defined in 5.3.9.4.4.
 *
 * @see segmentTemplateUrl
 */
function createSegmentsFromSegmentTemplate(
    deps: DashSegmentProviderDeps,
    options: GetTimelineOptions & {
        readonly segmentTemplate: SegmentTemplateType
    }
): readonly DataSegmentRef[] {
    const { baseUrl, periodTimeRange, representation, segmentTemplate } =
        options
    if (!segmentTemplate.media) {
        throw new ValidationError(
            'SegmentTemplate.media required',
            ErrorOrigin.MEDIA
        )
    }
    const media = segmentTemplate.media
    const presentationTimeOffset = segmentTemplate.presentationTimeOffset ?? 0

    const sampleTimes = calculateSegmentSampleTimes({
        multipleSegmentBase: segmentTemplate,
        periodTimeRange,
    })

    const timescale = getTimescale(segmentTemplate)
    let segmentNumber = segmentTemplate.startNumber ?? 1
    return createTimeline(
        {
            timescale,
            presentationTimeOffset,
            periodTimeRange,
            sampleTimes,
        },
        (_, sampleTime) => {
            const uri = segmentTemplateUrl(media, {
                representation,
                sampleTime,
                segmentNumber: segmentNumber++,
            })
            const { url, serviceLocation } = resolveDashUri(deps, {
                baseUrl,
                uri,
                representation,
            })
            return createSegmentDataProvider(deps, {
                url,
                serviceId: serviceLocation,
                reportDownlinkMetrics: true,
            })
        }
    )
}

/**
 * When SegmentBase is provided, get the timeline from the index range.
 */
async function createSegmentsFromSegmentBase(
    deps: DashSegmentProviderDeps,
    options: GetTimelineOptions & {
        readonly segmentBase: SegmentBaseType
    }
): Promise<readonly DataSegmentRef[]> {
    const { baseUrl, periodTimeRange, representation, segmentBase } = options
    if (segmentBase.indexRange) {
        // Load the sidx box from the mp4.
        const indexRange = segmentBase.indexRange
        const { url: indexUrl, serviceLocation: indexServiceLocation } =
            resolveDashUri(deps, { baseUrl, representation })
        const sidx = parseSidxBox(
            await createSegmentDataProvider(deps, {
                url: indexUrl,
                mediaRange: indexRange,
                serviceId: indexServiceLocation,
                reportDownlinkMetrics: false,
            })()
        )

        const sampleTimes = getSidxSampleTimes(sidx)
        let rangeStart = Number(sidx.firstOffset) + indexRange[1]! + 1
        return createTimeline(
            {
                sampleTimes,
                periodTimeRange,
                presentationTimeOffset: segmentBase.presentationTimeOffset ?? 0,
                timescale: sidx.timescale,
            },
            (i) => {
                const segmentReference = sidx.references[i]
                const size = segmentReference.referencedSize
                const provider = createSegmentDataProvider(deps, {
                    url: indexUrl,
                    mediaRange: [rangeStart, rangeStart + size - 1],
                    serviceId: indexServiceLocation,
                    reportDownlinkMetrics: true,
                })
                rangeStart += size
                return provider
            }
        )
    } else {
        throw new ValidationError('Manifest missing segments')
    }
}

/**
 * Returns an array of start times, in timescale units for the segments in the given multiple segment base.
 * The last time in the list will be the end time, in timescale units.
 */
function calculateSegmentSampleTimes(options: {
    readonly multipleSegmentBase: MultipleSegmentBaseType
    readonly periodTimeRange: PeriodRange
    readonly numSegments?: Maybe<number>
}): readonly number[] {
    const { multipleSegmentBase, periodTimeRange } = options
    const timescale = getTimescale(multipleSegmentBase)

    let startTimes: readonly number[]
    if (multipleSegmentBase.SegmentTimeline) {
        startTimes = calculateSampleTimesFromSegmentTimeline(
            multipleSegmentBase.SegmentTimeline
        )
    } else {
        // Fabricate a segment timeline from the segment duration.
        const sampleDuration = getSampleDuration(multipleSegmentBase) // The unscaled duration
        startTimes = calculateFixedSegmentSampleTimes({
            timescale,
            periodTimeRange,
            sampleDuration,
            numSegments: options.numSegments,
        })
    }
    return startTimes
}

/**
 * Given a SegmentTimeline element, calculates the sample start times of each segment, in timescale units.
 * The last time in the list will be the end time, in timescale units.
 */
function calculateSampleTimesFromSegmentTimeline(
    segmentTimeline: SegmentTimelineType
): readonly number[] {
    const out: number[] = new Array((segmentTimeline.S?.length ?? 0) + 1)
    let startTime = 0
    let c = 0

    segmentTimeline.S?.forEach((s) => {
        // If the start time 't' is defined, use it, otherwise use the calculated current time
        startTime = s.t != null ? s.t : startTime

        // Calculate segment details for the number of repeats
        for (let i = 0; i <= s.r; i++) {
            out[c++] = startTime
            startTime += s.d
        }
    })
    out[c++] = startTime
    return out
}

/**
 * Creates media segment sample start times, in timescale units, with a given duration.
 * The last time in the list will be the duration, in timescale units.
 *
 * @param options
 */
function calculateFixedSegmentSampleTimes(options: {
    readonly sampleDuration: number
    readonly timescale: number
    readonly periodTimeRange: PeriodRange
    readonly numSegments?: Maybe<number>
}): readonly number[] {
    const { sampleDuration, timescale } = options
    const [periodStart, periodEnd] = options.periodTimeRange
    if (periodEnd == null)
        throw new ValidationError(
            'MPD.mediaPresentationDuration or Period.duration required',
            ErrorOrigin.MEDIA
        )
    const numSegments =
        options.numSegments ??
        Math.ceil((periodEnd - periodStart) / (sampleDuration / timescale))
    const out: number[] = new Array(numSegments + 1)
    let startTime = 0
    for (let i = 0; i < numSegments; i++) {
        out[i] = startTime
        startTime += sampleDuration
    }
    out[numSegments] = periodEnd * timescale
    return out
}

/**
 * Creates a timeline of DataSegmentRef objects from a sample timeline list and a data provider factory.
 *
 * @param sampleTimes The list of sample times, in timescale units, to convert into MPD presentation times.
 * @param periodTimeRange The time range of the period, in seconds.
 * @param presentationTimeOffset The presentation time offset, in samples per second.
 * @param timescale The timescale units, in samples per second.
 * @param dataProviderFactory Creates the data provider for the segment at the given index and sample start time.
 */
function createTimeline(
    {
        sampleTimes,
        periodTimeRange,
        presentationTimeOffset,
        timescale,
    }: {
        sampleTimes: readonly number[]
        periodTimeRange: PeriodRange
        presentationTimeOffset: number
        timescale: number
    },
    dataProviderFactory: (i: number, sampleTime: number) => SegmentDataProvider
): readonly DataSegmentRef[] {
    const [periodStart, periodEnd] = periodTimeRange
    const mpdTimes = sampleTimes.map((sampleTime) => {
        return sampleToMpdTime(
            sampleTime,
            periodStart,
            presentationTimeOffset,
            timescale
        )
    })
    const n = mpdTimes.length - 1
    const out = new Array<DataSegmentRef>(n)
    for (let i = 0; i < n; i++) {
        const startTime = mpdTimes[i]
        const endTime = mpdTimes[i + 1]
        out[i] = {
            data: dataProviderFactory(i, sampleTimes[i]),
            timestampOffset: startTime,
            startTime: Math.max(periodStart, startTime),
            endTime: periodEnd == null ? endTime : Math.min(periodEnd, endTime),
        }
    }
    return out
}

/**
 * Validates that timescale is set, returning it.
 *
 * @param multipleSegmentBase
 */
function getTimescale(multipleSegmentBase: MultipleSegmentBaseType): number {
    if (!multipleSegmentBase.timescale)
        throw new ValidationError('invalid timescale', ErrorOrigin.MEDIA)
    return multipleSegmentBase.timescale
}

/**
 * Validates that duration is set, returning it.
 *
 * @param multipleSegmentBase
 */
function getSampleDuration(
    multipleSegmentBase: MultipleSegmentBaseType
): number {
    if (!multipleSegmentBase.duration)
        throw new ValidationError('invalid duration', ErrorOrigin.MEDIA)
    return multipleSegmentBase.duration
}
