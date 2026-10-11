/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    decodeSpliceInfoSection,
    decodeSpliceInfoSectionText,
    getSpliceAvail,
    Scte35Error,
    scte35TicksToSeconds,
    SegmentationType,
    type SpliceInfoSection,
} from '@amazon/vinyl'
import {
    segmentationDescriptor,
    spliceInfoSection,
    spliceInsertCommand,
    timeSignalCommand,
    toHex,
} from './scte35TestUtil'

describe('decodeSpliceInfoSection', () => {
    it('decodes the SCTE-35 time_signal placement opportunity example', () => {
        // ANSI/SCTE 35 14.2, time_signal with a placement opportunity start.
        const section = decodeSpliceInfoSectionText(
            '/DA0AAAAAAAA///wBQb+cr0AUAAeAhxDVUVJSAAAjn/PAAGlmbAICAAAAAAsoKGKNAIAmsnRfg=='
        )
        expect(section).toEqual({
            ptsAdjustment: 0,
            tier: 0xfff,
            encrypted: false,
            command: { type: 'timeSignal', spliceTime: 0x072bd0050 },
            descriptors: [
                {
                    type: 'segmentation',
                    segmentationEventId: 0x4800008e,
                    cancel: false,
                    segmentationDuration: 0x0001a599b0,
                    upidType: 0x08,
                    upid: new Uint8Array([0, 0, 0, 0, 0x2c, 0xa0, 0xa1, 0x8a]),
                    segmentationTypeId:
                        SegmentationType.PROVIDER_PLACEMENT_OPPORTUNITY_START,
                    segmentNum: 2,
                    segmentsExpected: 0,
                },
            ],
        })
        expect(getSpliceAvail(section)).toEqual({
            direction: 'out',
            eventId: 0x4800008e,
            time: 0x072bd0050,
            duration: 0x0001a599b0,
        })
    })

    it('decodes the SCTE-35 splice_insert example', () => {
        // ANSI/SCTE 35 14.3, splice_insert with an avail_descriptor.
        const section = decodeSpliceInfoSectionText(
            '/DAvAAAAAAAA///wFAVIAACPf+/+c2nALv4AUsz1AAAAAAAKAAhDVUVJAAABNWLbowo='
        )
        expect(section.command).toEqual({
            type: 'spliceInsert',
            spliceEventId: 0x4800008f,
            cancel: false,
            outOfNetwork: true,
            spliceImmediate: false,
            spliceTime: 0x07369c02e,
            breakDuration: { autoReturn: true, duration: 0x00052ccf5 },
            uniqueProgramId: 0,
            availNum: 0,
            availsExpected: 0,
        })
        expect(section.descriptors).toEqual([
            { type: 'unknown', tag: 0, identifier: 0x43554549 },
        ])
        expect(scte35TicksToSeconds(0x00052ccf5)).toBeCloseTo(60.2936, 4)
    })

    it('decodes the DASH-IF xml+bin example', () => {
        const section = decodeSpliceInfoSectionText(
            '/DAhAAAAAAAAAP/wEAUAAAfPf+9/fgAg9YDAAAAAAAA/APOv'
        )
        expect(getSpliceAvail(section)).toEqual({
            direction: 'out',
            eventId: 1999,
            time: null,
            duration: 24 * 90000,
        })
    })

    it('decodes hex text', () => {
        const bytes = spliceInfoSection({
            commandType: 0x05,
            command: spliceInsertCommand({
                eventId: 7,
                outOfNetwork: false,
                ptsTime: 900000,
            }),
        })
        expect(decodeSpliceInfoSectionText(` ${toHex(bytes)} `)).toEqual(
            decodeSpliceInfoSection(bytes)
        )
        expect(getSpliceAvail(decodeSpliceInfoSection(bytes))).toEqual({
            direction: 'in',
            eventId: 7,
            time: 900000,
            duration: null,
        })
    })

    it('decodes an ArrayBuffer', () => {
        const bytes = spliceInfoSection({
            commandType: 0x00,
            command: [],
        })
        expect(decodeSpliceInfoSection(bytes.buffer).command).toEqual({
            type: 'spliceNull',
        })
    })

    it('applies the pts adjustment, wrapping at 33 bits', () => {
        const bytes = spliceInfoSection({
            commandType: 0x05,
            ptsAdjustment: 2 ** 33 - 10,
            command: spliceInsertCommand({
                eventId: 1,
                outOfNetwork: true,
                ptsTime: 100,
            }),
        })
        expect(getSpliceAvail(decodeSpliceInfoSection(bytes))?.time).toBe(90)
    })

    it('decodes an immediate splice_insert', () => {
        const section = decodeSpliceInfoSection(
            spliceInfoSection({
                commandType: 0x05,
                command: spliceInsertCommand({
                    eventId: 3,
                    outOfNetwork: true,
                    immediate: true,
                    breakDuration: 90000,
                }),
            })
        )
        expect(section.command).toEqual(
            jasmine.objectContaining({
                spliceImmediate: true,
                spliceTime: null,
                breakDuration: { autoReturn: true, duration: 90000 },
            })
        )
    })

    it('decodes a component splice_insert by its first component time', () => {
        const bytes = [
            ...[0, 0, 0, 9], // splice_event_id
            0x7f, // cancel 0, reserved
            0x8f, // out 1, program_splice 0, duration 0, immediate 0
            2, // component_count
            ...[1, 0xfe, 0, 0, 0, 100], // tag, splice_time(100)
            ...[2, 0xfe, 0, 0, 0, 200],
            ...[0, 1, 0, 0],
        ]
        const section = decodeSpliceInfoSection(
            spliceInfoSection({ commandType: 0x05, command: bytes })
        )
        expect(section.command).toEqual(
            jasmine.objectContaining({ spliceEventId: 9, spliceTime: 100 })
        )
    })

    it('decodes a cancelled splice_insert, which is not an avail', () => {
        const section = decodeSpliceInfoSection(
            spliceInfoSection({
                commandType: 0x05,
                command: spliceInsertCommand({
                    eventId: 4,
                    outOfNetwork: true,
                    cancel: true,
                }),
            })
        )
        expect(section.command).toEqual(
            jasmine.objectContaining({ spliceEventId: 4, cancel: true })
        )
        expect(getSpliceAvail(section)).toBeNull()
    })

    it('decodes segmentation descriptors', () => {
        const section = decodeSpliceInfoSection(
            spliceInfoSection({
                commandType: 0x06,
                command: timeSignalCommand(null),
                descriptors: [
                    segmentationDescriptor({ eventId: 5, typeId: 0x01 }),
                    segmentationDescriptor({
                        eventId: 6,
                        typeId: 0x35,
                        cancel: true,
                    }),
                    segmentationDescriptor({
                        eventId: 7,
                        typeId: SegmentationType.PROVIDER_ADVERTISEMENT_END,
                        upidType: 0x0c,
                        upid: [1, 2, 3],
                    }),
                ],
            })
        )
        expect(section.command).toEqual({
            type: 'timeSignal',
            spliceTime: null,
        })
        expect(section.descriptors.length).toBe(3)
        expect(section.descriptors[1]).toEqual(
            jasmine.objectContaining({ cancel: true, segmentationEventId: 6 })
        )
        expect(section.descriptors[2]).toEqual(
            jasmine.objectContaining({
                upidType: 0x0c,
                upid: new Uint8Array([1, 2, 3]),
                segmentationDuration: null,
            })
        )
        // Skips the program content and cancelled descriptors.
        expect(getSpliceAvail(section)).toEqual({
            direction: 'in',
            eventId: 7,
            time: null,
            duration: null,
        })
    })

    it('decodes a component segmentation descriptor', () => {
        const body = [
            ...[0x43, 0x55, 0x45, 0x49],
            ...[0, 0, 0, 8], // segmentation_event_id
            0x7f,
            0x3f, // program_segmentation 0, duration 0, not restricted 1
            1, // component_count
            ...[1, 0xfe, 0, 0, 0, 0], // component_tag, reserved, pts_offset
            0, // upid type
            0, // upid length
            0x30,
            1,
            1,
        ]
        const section = decodeSpliceInfoSection(
            spliceInfoSection({
                commandType: 0x06,
                command: timeSignalCommand(0),
                descriptors: [[0x02, body.length, ...body]],
            })
        )
        expect(section.descriptors[0]).toEqual(
            jasmine.objectContaining({
                segmentationEventId: 8,
                segmentationTypeId: 0x30,
            })
        )
    })

    it('returns no avail for a time_signal without an ad descriptor', () => {
        const section = decodeSpliceInfoSection(
            spliceInfoSection({
                commandType: 0x06,
                command: timeSignalCommand(0),
                descriptors: [[0x01, 4, 0x43, 0x55, 0x45, 0x49]],
            })
        )
        expect(section.descriptors).toEqual([
            { type: 'unknown', tag: 1, identifier: 0x43554549 },
        ])
        expect(getSpliceAvail(section)).toBeNull()
    })

    it('returns no avail for other commands', () => {
        const section: SpliceInfoSection = decodeSpliceInfoSection(
            spliceInfoSection({ commandType: 0xff, command: [1, 2] })
        )
        expect(section.command).toEqual({ type: 'unknown', commandType: 0xff })
        expect(getSpliceAvail(section)).toBeNull()
    })

    it('does not decode an encrypted command', () => {
        const bytes = spliceInfoSection({
            commandType: 0x05,
            command: spliceInsertCommand({ eventId: 1, outOfNetwork: true }),
        })
        bytes[4] |= 0x80 // encrypted_packet
        const section = decodeSpliceInfoSection(bytes)
        expect(section.encrypted).toBeTrue()
        expect(section.command).toEqual({ type: 'unknown', commandType: 0x05 })
        expect(section.descriptors).toEqual([])
    })

    it('honors an unspecified splice_command_length', () => {
        const bytes = spliceInfoSection({
            commandType: 0x06,
            command: timeSignalCommand(5),
        })
        // splice_command_length = 0xFFF
        bytes[11] |= 0x0f
        bytes[12] = 0xff
        expect(decodeSpliceInfoSection(bytes).command).toEqual({
            type: 'timeSignal',
            spliceTime: 5,
        })
    })

    it('rejects malformed sections', () => {
        expect(() => decodeSpliceInfoSection([0x00])).toThrowError(
            Scte35Error,
            'not a splice_info_section'
        )
        expect(() => decodeSpliceInfoSection([0xfc, 0x30, 0x40])).toThrowError(
            Scte35Error,
            'splice_info_section is truncated'
        )
        expect(() =>
            decodeSpliceInfoSection([0xfc, 0x30, 0x02, 0, 0])
        ).toThrowError(Scte35Error, 'splice_info_section is truncated')
        expect(() => decodeSpliceInfoSectionText('0xFC3')).toThrowError(
            Scte35Error,
            'splice_info_section is not valid hex'
        )
        expect(() => decodeSpliceInfoSectionText('not base64!')).toThrowError(
            Scte35Error,
            'splice_info_section is not hex or base64'
        )
        expect(String(new Scte35Error('x'))).toContain('x')
        expect(Object.prototype.toString.call(new Scte35Error('x'))).toBe(
            '[object Scte35Error]'
        )
    })
})
