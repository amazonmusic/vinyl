/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { toJson } from '@amazon/vinyl-util'

describe('parseDashManifest events', () => {
    function parseEventStreams(eventStreams: string) {
        const manifest =
            parseDashManifest(`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     xmlns:scte35="http://www.scte.org/schemas/35/2016"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
     minBufferTime="PT2S" type="static" mediaPresentationDuration="PT120S">
    <Period id="p0" start="PT0S">
        ${eventStreams}
    </Period>
</MPD>`)
        return toJson(manifest.MPD.Period[0].EventStream)
    }

    it('parses a SCTE-35 xml+bin event body', () => {
        expect(
            parseEventStreams(`
        <EventStream schemeIdUri="urn:scte:scte35:2014:xml+bin" timescale="90000" presentationTimeOffset="900000">
            <Event presentationTime="6300000" duration="1350000" id="1">
                <scte35:Signal>
                    <scte35:Binary>/DAhAAAAAAAAAP/wEAUAAAfPf+9/fgAg9YDAAAAAAAA/APOv</scte35:Binary>
                </scte35:Signal>
            </Event>
        </EventStream>`)
        ).toEqual([
            {
                schemeIdUri: 'urn:scte:scte35:2014:xml+bin',
                timescale: 90000,
                presentationTimeOffset: 900000,
                actuate: 'onRequest',
                Event: [
                    {
                        presentationTime: 6300000,
                        duration: 1350000,
                        id: 1,
                        Signal: {
                            Binary: {
                                _content:
                                    '/DAhAAAAAAAAAP/wEAUAAAfPf+9/fgAg9YDAAAAAAAA/APOv',
                            },
                        },
                        _content: '',
                    },
                ],
            },
        ])
    })

    it('parses a SCTE-35 xml event body', () => {
        expect(
            parseEventStreams(`
        <EventStream schemeIdUri="urn:scte:scte35:2013:xml" timescale="90000">
            <Event presentationTime="5400000" duration="1350000" id="2">
                <scte35:SpliceInfoSection ptsAdjustment="0" tier="4095">
                    <scte35:SpliceInsert spliceEventId="2" spliceEventCancelIndicator="false"
                            outOfNetworkIndicator="true" spliceImmediateFlag="false"
                            uniqueProgramId="1" availNum="0" availsExpected="0">
                        <scte35:Program><scte35:SpliceTime ptsTime="5400000"/></scte35:Program>
                        <scte35:BreakDuration autoReturn="true" duration="1350000"/>
                    </scte35:SpliceInsert>
                </scte35:SpliceInfoSection>
            </Event>
            <Event presentationTime="9000000" id="3">
                <scte35:SpliceInfoSection>
                    <scte35:TimeSignal><scte35:SpliceTime ptsTime="9000000"/></scte35:TimeSignal>
                    <scte35:SegmentationDescriptor segmentationEventId="100"
                            segmentationEventCancelIndicator="false" segmentationDuration="2250000"
                            segmentationTypeId="52" segmentNum="1" segmentsExpected="1">
                        <scte35:SegmentationUpid segmentationUpidType="12" segmentationUpidFormat="text">ad-1</scte35:SegmentationUpid>
                    </scte35:SegmentationDescriptor>
                </scte35:SpliceInfoSection>
            </Event>
        </EventStream>`)
        ).toEqual([
            {
                schemeIdUri: 'urn:scte:scte35:2013:xml',
                timescale: 90000,
                actuate: 'onRequest',
                Event: [
                    {
                        presentationTime: 5400000,
                        duration: 1350000,
                        id: 2,
                        SpliceInfoSection: {
                            ptsAdjustment: 0,
                            tier: 4095,
                            SpliceInsert: {
                                spliceEventId: 2,
                                spliceEventCancelIndicator: false,
                                outOfNetworkIndicator: true,
                                spliceImmediateFlag: false,
                                uniqueProgramId: 1,
                                availNum: 0,
                                availsExpected: 0,
                                Program: { SpliceTime: { ptsTime: 5400000 } },
                                BreakDuration: {
                                    autoReturn: true,
                                    duration: 1350000,
                                },
                            },
                        },
                        _content: '',
                    },
                    {
                        presentationTime: 9000000,
                        id: 3,
                        SpliceInfoSection: {
                            TimeSignal: { SpliceTime: { ptsTime: 9000000 } },
                            SegmentationDescriptor: [
                                {
                                    segmentationEventId: 100,
                                    segmentationEventCancelIndicator: false,
                                    segmentationDuration: 2250000,
                                    segmentationTypeId: 52,
                                    segmentNum: 1,
                                    segmentsExpected: 1,
                                    SegmentationUpid: [
                                        {
                                            segmentationUpidType: 12,
                                            segmentationUpidFormat: 'text',
                                            _content: 'ad-1',
                                        },
                                    ],
                                },
                            ],
                        },
                        _content: '',
                    },
                ],
            },
        ])
    })

    it('parses alternative MPD events', () => {
        expect(
            parseEventStreams(`
        <EventStream schemeIdUri="urn:mpeg:dash:event:alternativeMPD:replace:2025" timescale="1000">
            <Event presentationTime="60000" duration="15000" id="1">
                <ReplacePresentation uri="https://ads.example.com/break.mpd"
                        earliestResolutionTimeOffset="10000" maxDuration="15000"
                        returnOffset="15000" clip="true" startWithOffset="false"/>
            </Event>
        </EventStream>
        <EventStream schemeIdUri="urn:mpeg:dash:event:alternativeMPD:insert:2025" timescale="1000">
            <Event presentationTime="0" id="2">
                <InsertPresentation uri="preroll.mpd" maxDuration="30000"/>
            </Event>
        </EventStream>`)
        ).toEqual([
            {
                schemeIdUri: 'urn:mpeg:dash:event:alternativeMPD:replace:2025',
                timescale: 1000,
                actuate: 'onRequest',
                Event: [
                    {
                        presentationTime: 60000,
                        duration: 15000,
                        id: 1,
                        ReplacePresentation: {
                            uri: 'https://ads.example.com/break.mpd',
                            earliestResolutionTimeOffset: 10000,
                            maxDuration: 15000,
                            returnOffset: 15000,
                            clip: true,
                            startWithOffset: false,
                        },
                        _content: '',
                    },
                ],
            },
            {
                schemeIdUri: 'urn:mpeg:dash:event:alternativeMPD:insert:2025',
                timescale: 1000,
                actuate: 'onRequest',
                Event: [
                    {
                        presentationTime: 0,
                        id: 2,
                        InsertPresentation: {
                            uri: 'preroll.mpd',
                            maxDuration: 30000,
                        },
                        _content: '',
                    },
                ],
            },
        ])
    })

    it('parses a base64 event body', () => {
        const [eventStream] = parseEventStreams(`
        <EventStream schemeIdUri="urn:scte:scte35:2013:bin" timescale="90000">
            <Event presentationTime="0" id="4" contentEncoding="base64">/DAhAAAAAAAAAP/wEAUAAAfPf+9/fgAg9YDAAAAAAAA/APOv</Event>
        </EventStream>`)!
        expect(eventStream.Event).toEqual([
            {
                presentationTime: 0,
                id: 4,
                contentEncoding: 'base64',
                _content: '/DAhAAAAAAAAAP/wEAUAAAfPf+9/fgAg9YDAAAAAAAA/APOv',
            },
        ])
    })
})
