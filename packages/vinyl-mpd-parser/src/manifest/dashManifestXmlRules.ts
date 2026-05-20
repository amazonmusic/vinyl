/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parser definitions for a dash manifest.
 * Attribute order does not matter, element order matters for writing.
 *
 * @module
 */

import type { actuateType, UriType } from '@amazon/vinyl-xml'
import {
    assertActuateEnum,
    attr,
    attrBoolean,
    attrDateTime,
    attrFloat,
    attrInt,
    attrString,
    charactersString,
    element,
    elements,
    type XmlRules,
} from '@amazon/vinyl-xml'
import { ErrorOrigin, stringify } from '@amazon/vinyl-util'
import { isOneOf, number, type Validator } from '@amazon/vinyl-validation'
import { parseDuration, stringifyDuration } from '@/duration/duration'
import { parseByteRange, stringifyByteRange } from '@/media/byteRange'
import { parseRatio, stringifyRatio } from '@/media/ratio'
import { parseFrameRate, stringifyFrameRate } from '@/media/frameRate'
import type {
    AdaptationSetType,
    BaseURLType,
    ConditionalUintType,
    ContentComponentType,
    DashManifest,
    DescriptorType,
    EventStreamType,
    EventType,
    MetricsType,
    MPDtype,
    MultipleSegmentBaseType,
    PeriodType,
    PresentationType,
    ProgramInformationType,
    RangeType,
    RepresentationBaseType,
    RepresentationType,
    SegmentBaseType,
    SegmentListType,
    SegmentTemplateType,
    SegmentTimelineType,
    SegmentTimelineTypeSType,
    SegmentURLType,
    SubRepresentationType,
    SubsetType,
    SwitchingType,
    SwitchingTypeType,
    URLType,
    VideoScanType,
} from '@/xmlns/mpeg/dash/schema/mpd/2011'

export const dashNamespaceUri = 'urn:mpeg:dash:schema:mpd:2011'

export function dashManifestXmlRules(): XmlRules<DashManifest> {
    const attrActuateType = attr<actuateType>(assertActuateEnum, stringify, {
        default: 'onRequest',
    } as const)

    const descriptorType: XmlRules<DescriptorType> = {
        id: attrString,
        schemeIdUri: attrString({ required: true }),
        value: attrString,
    } as const

    const baseURLType: XmlRules<BaseURLType> = {
        availabilityTimeComplete: attrBoolean,
        availabilityTimeOffset: attrFloat,
        byteRange: attrString,
        serviceLocation: attrString,
        _content: charactersString,
    } as const

    const contentComponentType: XmlRules<ContentComponentType> = {
        contentType: attrString,
        id: attrInt,
        lang: attrString,
        par: attr(parseRatio, stringifyRatio),
        Accessibility: elements(descriptorType),
        Rating: elements(descriptorType),
        Role: elements(descriptorType),
        Viewpoint: elements(descriptorType),
    } as const

    const urlType: XmlRules<URLType> = {
        range: attr(parseByteRange, stringifyByteRange),
        sourceURL: attrString,
    } as const

    const uriType: XmlRules<UriType> = { _content: charactersString } as const

    const segmentBaseType: XmlRules<SegmentBaseType> = {
        Initialization: element(urlType),
        RepresentationIndex: element(urlType),
        availabilityTimeComplete: attrBoolean,
        availabilityTimeOffset: attrInt,
        indexRange: attr(parseByteRange, stringifyByteRange),
        indexRangeExact: attrBoolean({ default: false }),
        presentationTimeOffset: attrFloat,
        timescale: attrInt,
    } as const

    const segmentTimelineTypeSType: XmlRules<SegmentTimelineTypeSType> = {
        d: attrInt({ required: true }),
        n: attrInt,
        r: attrInt({ default: 0 }),
        t: attrInt,
    } as const

    const segmentTimelineType: XmlRules<SegmentTimelineType> = {
        S: elements(segmentTimelineTypeSType),
    } as const

    const multipleSegmentBaseType: XmlRules<MultipleSegmentBaseType> = {
        ...segmentBaseType,
        SegmentTimeline: element(segmentTimelineType),
        BitstreamSwitching: element(urlType),
        duration: attrInt,
        startNumber: attrInt,
    } as const

    const segmentURLType: XmlRules<SegmentURLType> = {
        index: attrString,
        indexRange: attr(parseByteRange, stringifyByteRange),
        media: attrString,
        mediaRange: attr(parseByteRange, stringifyByteRange),
    } as const

    const segmentListType: XmlRules<SegmentListType> = {
        ...multipleSegmentBaseType,
        actuate: attrActuateType,
        href: attrString,
        SegmentURL: elements(segmentURLType),
    } as const

    const segmentTemplateType: XmlRules<SegmentTemplateType> = {
        ...multipleSegmentBaseType,
        bitstreamSwitching: attrString,
        index: attrString,
        initialization: attrString,
        media: attrString,
    } as const

    const subsetType: XmlRules<SubsetType> = {
        contains: attr(parseIntVector, stringifyIntVector, { required: true }),
        id: attrString,
    } as const

    const eventType: XmlRules<EventType> = {
        duration: attrInt,
        id: attrInt,
        messageData: attrString,
        presentationTime: attrInt({ default: 0 }),
    } as const

    const eventStreamType: XmlRules<EventStreamType> = {
        Event: elements(eventType),
        actuate: attrActuateType,
        href: attrString,
        messageData: attrString,
        schemeIdUri: attrString({ required: true }),
        timescale: attrInt,
        value: attrString,
    } as const

    const switchingType: XmlRules<SwitchingType> = {
        interval: attrInt({ required: true }),
        type: attr(parseSwitchingTypeType, stringify),
    } as const

    const representationBaseType: XmlRules<RepresentationBaseType> = {
        FramePacking: elements(descriptorType),
        AudioChannelConfiguration: elements(descriptorType),
        ContentProtection: elements(descriptorType),
        EssentialProperty: elements(descriptorType),
        SupplementalProperty: elements(descriptorType),
        InbandEventStream: elements(eventStreamType),
        Switching: elements(switchingType),
        audioSamplingRate: attr(parseIntVector, stringifyIntVector),
        codecs: attrString,
        codingDependency: attrBoolean,
        frameRate: attr(parseFrameRate, stringifyFrameRate),
        height: attrInt,
        maximumSAPPeriod: attrInt,
        maxPlayoutRate: attrInt,
        mimeType: attrString,
        profiles: attr(parseProfiles, stringifyProfiles),
        sar: attr(parseRatio, stringifyRatio),
        scanType: attr(parseVideoScan, stringify),
        segmentProfiles: attrString,
        startWithSAP: attr(parseSap, stringify),
        width: attrInt,
    } as const

    const subRepresentationType: XmlRules<SubRepresentationType> = {
        ...representationBaseType,
        bandwidth: attrInt,
        contentComponent: attr(parseStringVector, stringifyStringVector),
        dependencyLevel: attr(parseIntVector, stringifyIntVector),
        level: attrInt,
    } as const

    const representationType: XmlRules<RepresentationType> = {
        ...representationBaseType,
        bandwidth: attrInt({ required: true }),
        bitrate: attrInt,
        dependencyId: attr(parseStringVector, stringifyStringVector),
        id: attrString({ required: true }),
        mediaStreamStructureId: attr(parseStringVector, stringifyStringVector),
        qualityRanking: attrInt,
        BaseURL: elements(baseURLType),
        SegmentBase: element(segmentBaseType),
        SegmentList: element(segmentListType),
        SegmentTemplate: element(segmentTemplateType),
        SubRepresentation: elements(subRepresentationType),
    } as const

    const adaptationSetType: XmlRules<AdaptationSetType> = {
        ...representationBaseType,
        Accessibility: elements(descriptorType),
        Role: elements(descriptorType),
        Rating: elements(descriptorType),
        Viewpoint: elements(descriptorType),
        ContentComponent: elements(contentComponentType),
        BaseURL: elements(baseURLType),
        SegmentBase: element(segmentBaseType),
        SegmentList: element(segmentListType),
        SegmentTemplate: element(segmentTemplateType),
        Representation: elements(representationType),
        actuate: attrActuateType,
        bitstreamSwitching: attrBoolean,
        contentType: attrString,
        group: attrInt,
        href: attrString,
        id: attrInt,
        lang: attrString,
        maxBandwidth: attrInt,
        maxFrameRate: attr(parseFrameRate, stringifyFrameRate),
        maxHeight: attrInt,
        maxWidth: attrInt,
        minBandwidth: attrInt,
        minFrameRate: attr(parseFrameRate, stringifyFrameRate),
        minHeight: attrInt,
        minWidth: attrInt,
        par: attr(parseRatio, stringifyRatio),
        segmentAlignment: attr(parseConditionalUint, stringify, {
            default: false,
        }),
        selectionPriority: attrInt({
            default: 1,
        }),
        subsegmentAlignment: attr(parseConditionalUint, stringify, {
            default: false,
        }),
        subsegmentStartsWithSAP: attr(parseSap, stringify, { default: 0 }),
    } as const

    const rangeType: XmlRules<RangeType> = {
        duration: attr(parseDuration, stringifyDuration),
        starttime: attr(parseDuration, stringifyDuration),
    } as const

    const metricsType: XmlRules<MetricsType> = {
        metrics: attrString({ required: true }),
        Range: elements(rangeType),
        Reporting: elements(descriptorType, { minOccurs: 1 }),
    } as const

    const periodType: XmlRules<PeriodType> = {
        BaseURL: elements(baseURLType),
        SegmentBase: element(segmentBaseType),
        SegmentList: element(segmentListType),
        SegmentTemplate: element(segmentTemplateType),
        AssetIdentifier: element(descriptorType),
        EventStream: elements(eventStreamType),
        AdaptationSet: elements(adaptationSetType),
        Subset: elements(subsetType),
        SupplementalProperty: elements(descriptorType),
        actuate: attrActuateType,
        bitstreamSwitching: attrBoolean({ default: false }),
        duration: attr(parseDuration, stringifyDuration),
        href: attrString,
        id: attrString,
        start: attr(parseDuration, stringifyDuration),
    } as const

    const programInformationType: XmlRules<ProgramInformationType> = {
        lang: attrString,
        moreInformationURL: attrString,
        Copyright: attrString,
        Source: attrString,
        Title: attrString,
    } as const

    const mpdType: XmlRules<MPDtype> = {
        ProgramInformation: elements(programInformationType),
        BaseURL: elements(baseURLType),
        Location: elements(uriType),
        Period: elements(periodType, { minOccurs: 1 }),
        Metrics: elements(metricsType),
        EssentialProperty: elements(descriptorType),
        SupplementalProperty: elements(descriptorType),
        UTCTiming: elements(descriptorType),
        availabilityEndTime: attrDateTime,
        availabilityStartTime: attrDateTime,
        id: attrString,
        maxSegmentDuration: attr(parseDuration, stringifyDuration),
        maxSubsegmentDuration: attr(parseDuration, stringifyDuration),
        mediaPresentationDuration: attr(parseDuration, stringifyDuration),
        minBufferTime: attr(parseDuration, stringifyDuration, {
            required: true,
        }),
        minimumUpdatePeriod: attr(parseDuration, stringifyDuration),
        profiles: attr(parseProfiles, stringifyProfiles, { required: true }),
        publishTime: attrDateTime,
        suggestedPresentationDelay: attr(parseDuration, stringifyDuration),
        timeShiftBufferDepth: attr(parseDuration, stringifyDuration),
        type: attr(parsePresentationTypeType, stringify, {
            default: 'static',
        } as const),
    } as const

    return {
        MPD: element(mpdType, {
            required: true,
            namespaceUri: dashNamespaceUri,
        }),
    } as const
}

/**
 * Parses a comma delimited list of profiles.
 * Profile values are not whitespace trimmed.
 *
 * @param str
 */
export function parseProfiles(str: string): readonly string[] {
    return str.split(',')
}

/**
 * Returns the string representation of a {@link FrameRate} value.
 *
 * @param value
 */
export function stringifyProfiles(value: readonly string[]): string {
    return value.join(',')
}

const videoScanTypeValidator: Validator<VideoScanType> = isOneOf(
    'progressive',
    'interlaced',
    'unknown'
)

/**
 * @private
 */
export function parseVideoScan(str: string): VideoScanType {
    videoScanTypeValidator.assert(str, ErrorOrigin.PARSING)
    return str
}

const switchingTypeTypeValidator: Validator<SwitchingTypeType> = isOneOf(
    'media',
    'bitstream'
)

/**
 * @private
 */
export function parseSwitchingTypeType(str: string): SwitchingTypeType {
    switchingTypeTypeValidator.assert(str, ErrorOrigin.PARSING)
    return str
}

const validateSap: Validator<number> = number().within(0, 6)

/**
 * @private
 */
export function parseSap(str: string): number {
    const number = parseInt(str)
    validateSap.assert(number, ErrorOrigin.PARSING)
    return number
}

/**
 * Splits a string by whitespace.
 *
 * @private
 */
export function parseStringVector(str: string): readonly string[] {
    return str.split(/\s+/)
}

/**
 * Returns the string representation of a string vector value.
 *
 * @param value
 */
export function stringifyStringVector(value: readonly string[]): string {
    return value.join(' ')
}

/**
 * Splits a string by whitespace and parses as int.
 *
 * @private
 */
export function parseIntVector(str: string): readonly number[] {
    return str.split(/\s+/).map((subStr) => parseInt(subStr))
}

/**
 * Returns the string representation of an int vector value.
 *
 * @param value
 */
export function stringifyIntVector(value: readonly number[]): string {
    return value.join(' ')
}

const presentationTypeValidator: Validator<PresentationType> = isOneOf(
    'static',
    'dynamic'
)

/**
 * Asserts that the given string is one of the {@link PresentationType} enumerated values.
 * @param str
 */
export function parsePresentationTypeType(str: string): PresentationType {
    presentationTypeValidator.assert(str, ErrorOrigin.PARSING)
    return str
}

/**
 * Parses a string into true, false, or a number.
 *
 * @private
 */
export function parseConditionalUint(str: string): ConditionalUintType {
    const lower = str.toLowerCase()
    switch (lower) {
        case 'true':
            return true
        case 'false':
            return false
        default:
            return parseInt(str)
    }
}
