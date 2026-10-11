/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    attrBoolean,
    attrInt,
    attrString,
    charactersString,
    element,
    elements,
    type XmlRules,
} from '@amazon/vinyl-xml'
import { dashNamespaceUri } from '../../dashManifestXmlRules'
import {
    SCTE35_2016_NAMESPACE_URI,
    type Scte35BinaryType,
    type Scte35BreakDurationType,
    type Scte35ProgramType,
    type Scte35SegmentationDescriptorType,
    type Scte35SegmentationUpidType,
    type Scte35SpliceInsertType,
    type Scte35SpliceNullType,
    type Scte35TimeSignalType,
    type Scte35SignalType,
    type Scte35SpliceInfoSectionType,
    type Scte35SpliceTimeType,
} from '../../../xmlns/scte/35/2016'

/**
 * The SCTE-35 bodies of an MPD `Event`, per SCTE 214-1.
 */
export interface Scte35Event {
    /** The body of a `urn:scte:scte35:2014:xml+bin` event. */
    readonly Signal?: Scte35SignalType

    /** The body of a `urn:scte:scte35:2013:xml` event. */
    readonly SpliceInfoSection?: Scte35SpliceInfoSectionType
}

export interface EventStreamScte35Events {
    readonly Event?: readonly Scte35Event[]
}

export interface PeriodScte35Events {
    readonly EventStream?: readonly EventStreamScte35Events[]
}

export interface MPDScte35Events {
    readonly Period: readonly PeriodScte35Events[]
}

export interface DashScte35Events {
    readonly MPD: MPDScte35Events
}

const options = { namespaceUri: SCTE35_2016_NAMESPACE_URI } as const

const spliceTimeType: XmlRules<Scte35SpliceTimeType> = {
    ptsTime: attrInt,
} as const

const segmentationUpidType: XmlRules<Scte35SegmentationUpidType> = {
    segmentationUpidType: attrInt,
    segmentationUpidFormat: attrString,
    _content: charactersString,
} as const

const segmentationDescriptorType: XmlRules<Scte35SegmentationDescriptorType> = {
    segmentationEventId: attrInt,
    segmentationEventCancelIndicator: attrBoolean,
    segmentationDuration: attrInt,
    segmentationTypeId: attrInt,
    segmentNum: attrInt,
    segmentsExpected: attrInt,
    SegmentationUpid: elements(segmentationUpidType, options),
} as const

const programType: XmlRules<Scte35ProgramType> = {
    SpliceTime: element(spliceTimeType, options),
} as const

const breakDurationType: XmlRules<Scte35BreakDurationType> = {
    autoReturn: attrBoolean,
    duration: attrInt,
} as const

const spliceInsertType: XmlRules<Scte35SpliceInsertType> = {
    spliceEventId: attrInt,
    spliceEventCancelIndicator: attrBoolean,
    outOfNetworkIndicator: attrBoolean,
    spliceImmediateFlag: attrBoolean,
    uniqueProgramId: attrInt,
    availNum: attrInt,
    availsExpected: attrInt,
    Program: element(programType, options),
    BreakDuration: element(breakDurationType, options),
} as const

const timeSignalType: XmlRules<Scte35TimeSignalType> = {
    SpliceTime: element(spliceTimeType, options),
} as const

const spliceNullType: XmlRules<Scte35SpliceNullType> = {} as const

const spliceInfoSectionType: XmlRules<Scte35SpliceInfoSectionType> = {
    ptsAdjustment: attrInt,
    tier: attrInt,
    SpliceNull: element(spliceNullType, options),
    SpliceInsert: element(spliceInsertType, options),
    TimeSignal: element(timeSignalType, options),
    SegmentationDescriptor: elements(segmentationDescriptorType, options),
} as const

const binaryType: XmlRules<Scte35BinaryType> = {
    _content: charactersString,
} as const

const signalType: XmlRules<Scte35SignalType> = {
    Binary: element(binaryType, options),
} as const

/**
 * Parsing rules for SCTE-35 MPD events, in the SCTE-35 2016 XML namespace.
 */
export const scte35EventXmlRules: XmlRules<Scte35Event> = {
    Signal: element(signalType, options),
    SpliceInfoSection: element(spliceInfoSectionType, options),
} as const

/**
 * Creates the rules map for SCTE-35 MPD event bodies, to be merged with the
 * dash manifest rules.
 */
export function createDashScte35EventXmlRules(): XmlRules<DashScte35Events> {
    return {
        MPD: element<MPDScte35Events>(
            {
                Period: elements<PeriodScte35Events>(
                    {
                        EventStream: elements<EventStreamScte35Events>({
                            Event: elements(scte35EventXmlRules),
                        }),
                    },
                    { minOccurs: 1 }
                ),
            },
            { required: true, namespaceUri: dashNamespaceUri } as const
        ),
    } as const
}
