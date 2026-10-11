/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SCTE-35 XML types, as carried in DASH MPD events per SCTE 214-1.
 *
 * Only the elements and attributes that describe ad avails are modeled.
 *
 * @see https://www.scte.org/standards/library/catalog/scte-35-digital-program-insertion-cueing-message/
 * @module
 */

export const SCTE35_2016_NAMESPACE_URI = 'http://www.scte.org/schemas/35/2016'

/**
 * `scte35:Signal`, the event body of the `urn:scte:scte35:2014:xml+bin`
 * scheme: a binary `splice_info_section`, base64 encoded.
 */
export interface Scte35SignalType {
    readonly Binary?: Scte35BinaryType
}

export interface Scte35BinaryType {
    /** The base64 encoded `splice_info_section`. */
    readonly _content?: string
}

/**
 * `scte35:SpliceInfoSection`, the event body of the `urn:scte:scte35:2013:xml`
 * scheme.
 */
export interface Scte35SpliceInfoSectionType {
    readonly ptsAdjustment?: number
    readonly tier?: number
    readonly SpliceNull?: Scte35SpliceNullType
    readonly SpliceInsert?: Scte35SpliceInsertType
    readonly TimeSignal?: Scte35TimeSignalType
    readonly SegmentationDescriptor?: readonly Scte35SegmentationDescriptorType[]
}

export interface Scte35SpliceTimeType {
    readonly ptsTime?: number
}

export interface Scte35SpliceInsertType {
    readonly spliceEventId?: number
    readonly spliceEventCancelIndicator?: boolean
    readonly outOfNetworkIndicator?: boolean
    readonly spliceImmediateFlag?: boolean
    readonly uniqueProgramId?: number
    readonly availNum?: number
    readonly availsExpected?: number
    readonly Program?: Scte35ProgramType
    readonly BreakDuration?: Scte35BreakDurationType
}

export type Scte35SpliceNullType = Record<never, never>

export interface Scte35ProgramType {
    readonly SpliceTime?: Scte35SpliceTimeType
}

export interface Scte35BreakDurationType {
    readonly autoReturn?: boolean
    readonly duration?: number
}

export interface Scte35TimeSignalType {
    readonly SpliceTime?: Scte35SpliceTimeType
}

export interface Scte35SegmentationDescriptorType {
    readonly segmentationEventId?: number
    readonly segmentationEventCancelIndicator?: boolean
    readonly segmentationDuration?: number
    readonly segmentationTypeId?: number
    readonly segmentNum?: number
    readonly segmentsExpected?: number
    readonly SegmentationUpid?: readonly Scte35SegmentationUpidType[]
}

export interface Scte35SegmentationUpidType {
    readonly segmentationUpidType?: number
    /** `text` or `hexbinary` (the default). */
    readonly segmentationUpidFormat?: string
    readonly _content?: string
}
