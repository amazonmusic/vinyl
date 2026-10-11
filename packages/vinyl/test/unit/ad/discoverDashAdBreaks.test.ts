/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    DashAlternativeMpdScheme,
    DashScte35Scheme,
    discoverDashAdBreaks,
    spliceInfoSectionFromXml,
} from '@amazon/vinyl'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import {
    segmentationDescriptor,
    spliceInfoSection,
    spliceInsertCommand,
    timeSignalCommand,
    toBase64,
} from './scte35/scte35TestUtil'

describe('discoverDashAdBreaks', () => {
    const BASE = 'https://cdn.example.com/content/stream.mpd'

    function mpd(periods: string, duration = 'PT120S') {
        return parseDashManifest(`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     xmlns:scte35="http://www.scte.org/schemas/35/2016"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
     minBufferTime="PT2S" type="static" mediaPresentationDuration="${duration}">
    ${periods}
</MPD>`)
    }

    function spliceInsertBase64(
        options: Parameters<typeof spliceInsertCommand>[0]
    ): string {
        return toBase64(
            spliceInfoSection({
                commandType: 0x05,
                command: spliceInsertCommand(options),
            })
        )
    }

    function xmlBinEvent(attributes: string, binary: string) {
        return `<Event ${attributes}>
            <scte35:Signal><scte35:Binary>${binary}</scte35:Binary></scte35:Signal>
        </Event>`
    }

    describe('SCTE-35', () => {
        it('maps a multi-period SSAI avail to a stitched break with an ad per Period', () => {
            const binary = spliceInsertBase64({
                eventId: 1,
                outOfNetwork: true,
                breakDuration: 25 * 90000,
            })
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period id="content-0" start="PT0S" duration="PT60S"/>
    <Period id="ad-a" start="PT60S" duration="PT20S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}" timescale="90000" presentationTimeOffset="900000">
            ${xmlBinEvent('presentationTime="900000" duration="2250000" id="10"', binary)}
        </EventStream>
    </Period>
    <Period id="ad-b" start="PT80S" duration="PT5S"/>
    <Period id="content-1" start="PT85S"/>`),
                BASE,
                120
            )
            expect(breaks.length).toBe(1)
            const [adBreak] = breaks
            expect(adBreak).toEqual(
                jasmine.objectContaining({
                    id: '10',
                    startTime: 60,
                    duration: 25,
                    placement: 'midroll',
                    insertion: 'stitched',
                    once: false,
                    resumeOffset: 25,
                    playoutLimit: null,
                    resolutionTimeOffset: null,
                    skipControl: null,
                    ads: [
                        { id: 'ad-a', startTime: 60, duration: 20, uri: null },
                        { id: 'ad-b', startTime: 80, duration: 5, uri: null },
                    ],
                })
            )
            expect(adBreak.signal?.source).toBe('dash-scte35')
            expect(adBreak.signal?.schemeIdUri).toBe(DashScte35Scheme.XML_BIN)
            expect(adBreak.signal?.scte35[0].command.type).toBe('spliceInsert')
        })

        it('takes the duration from the SCTE-35 break duration', () => {
            const [adBreak] = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}" timescale="1">
            ${xmlBinEvent(
                'presentationTime="30" id="1"',
                spliceInsertBase64({
                    eventId: 1,
                    outOfNetwork: true,
                    breakDuration: 15 * 90000,
                })
            )}
        </EventStream>
    </Period>`),
                BASE
            )
            expect(adBreak).toEqual(
                jasmine.objectContaining({
                    startTime: 30,
                    duration: 15,
                    ads: [
                        { id: '1-0', startTime: 30, duration: 15, uri: null },
                    ],
                })
            )
        })

        it('pairs a splice out with its splice in', () => {
            const out = spliceInsertBase64({ eventId: 7, outOfNetwork: true })
            const back = spliceInsertBase64({ eventId: 7, outOfNetwork: false })
            const [adBreak, ...rest] = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}" timescale="1">
            ${xmlBinEvent('presentationTime="30" id="1"', out)}
            ${xmlBinEvent('presentationTime="42" id="2"', back)}
        </EventStream>
    </Period>`),
                BASE
            )
            expect(rest).toEqual([])
            expect(adBreak.duration).toBe(12)
            expect(adBreak.signal?.scte35.length).toBe(2)
        })

        it('leaves an unpaired avail without a duration', () => {
            const [adBreak] = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}">
            ${xmlBinEvent(
                'presentationTime="30"',
                spliceInsertBase64({ eventId: 7, outOfNetwork: true })
            )}
        </EventStream>
    </Period>`),
                BASE
            )
            expect(adBreak).toEqual(
                jasmine.objectContaining({
                    // Without an Event id, the SCTE-35 event id identifies it.
                    id: '7',
                    duration: null,
                    ads: [
                        { id: '7-0', startTime: 30, duration: null, uri: null },
                    ],
                })
            )
        })

        it('leaves an open-ended ad Period without a duration', () => {
            const manifest =
                parseDashManifest(`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:scte35="http://www.scte.org/schemas/35/2016"
     profiles="urn:mpeg:dash:profile:isoff-live:2011" minBufferTime="PT2S" type="dynamic"
     availabilityStartTime="2024-01-01T00:00:00Z">
    <Period id="content" start="PT0S"/>
    <Period id="ad" start="PT30S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}">
            ${xmlBinEvent(
                'presentationTime="0" id="1"',
                spliceInsertBase64({ eventId: 1, outOfNetwork: true })
            )}
        </EventStream>
    </Period>
</MPD>`)
            const [adBreak] = discoverDashAdBreaks(manifest, BASE, Infinity)
            expect(adBreak.ads).toEqual([
                { id: 'ad', startTime: 30, duration: null, uri: null },
            ])
        })

        it('maps a time_signal placement opportunity', () => {
            const binary = toBase64(
                spliceInfoSection({
                    commandType: 0x06,
                    command: timeSignalCommand(0),
                    descriptors: [
                        segmentationDescriptor({
                            eventId: 100,
                            typeId: 0x34,
                            duration: 20 * 90000,
                        }),
                    ],
                })
            )
            const [adBreak] = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}" timescale="1">
            ${xmlBinEvent('presentationTime="10" id="5"', binary)}
        </EventStream>
    </Period>`),
                BASE
            )
            expect(adBreak.duration).toBe(20)
        })

        it('maps SCTE-35 XML events', () => {
            const [adBreak] = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML}" timescale="90000">
            <Event presentationTime="5400000" id="2">
                <scte35:SpliceInfoSection ptsAdjustment="0" tier="4095">
                    <scte35:SpliceInsert spliceEventId="2" outOfNetworkIndicator="true">
                        <scte35:Program><scte35:SpliceTime ptsTime="5400000"/></scte35:Program>
                        <scte35:BreakDuration autoReturn="true" duration="1350000"/>
                    </scte35:SpliceInsert>
                </scte35:SpliceInfoSection>
            </Event>
        </EventStream>
    </Period>`),
                BASE
            )
            expect(adBreak).toEqual(
                jasmine.objectContaining({ startTime: 60, duration: 15 })
            )
            expect(adBreak.signal?.scte35[0].command).toEqual({
                type: 'spliceInsert',
                spliceEventId: 2,
                cancel: false,
                outOfNetwork: true,
                spliceImmediate: false,
                spliceTime: 5400000,
                breakDuration: { autoReturn: true, duration: 1350000 },
                uniqueProgramId: 0,
                availNum: 0,
                availsExpected: 0,
            })
        })

        it('maps base64 bin events', () => {
            const binary = spliceInsertBase64({
                eventId: 3,
                outOfNetwork: true,
                breakDuration: 90000,
            })
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.BIN}">
            <Event presentationTime="10" id="1" contentEncoding="base64">${binary}</Event>
            <Event presentationTime="20" id="2" messageData="${binary}"/>
            <Event presentationTime="30" id="3"/>
        </EventStream>
    </Period>`),
                BASE
            )
            // An event without a section is placed by its own timing.
            expect(breaks.map((b) => [b.startTime, b.duration])).toEqual([
                [10, 1],
                [20, 1],
                [30, null],
            ])
        })

        it('identifies events without ids by time, and names unnamed ad Periods', () => {
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period start="PT0S" duration="PT30S">
        <EventStream schemeIdUri="${DashScte35Scheme.BIN}"/>
        <EventStream schemeIdUri="${DashScte35Scheme.BIN}">
            <Event presentationTime="30" duration="10"/>
        </EventStream>
    </Period>
    <Period start="PT30S" duration="PT10S"/>
    <Period id="c" start="PT40S"/>`),
                BASE,
                120
            )
            expect(breaks.map((b) => b.id)).toEqual(['30'])
            expect(breaks[0].ads).toEqual([
                { id: '30-0', startTime: 30, duration: 10, uri: null },
            ])
        })

        it('ignores sections that are not avails, and keeps undecodable ones', () => {
            const heartbeat = toBase64(
                spliceInfoSection({ commandType: 0x00, command: [] })
            )
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}">
            ${xmlBinEvent('presentationTime="10" id="1"', heartbeat)}
            ${xmlBinEvent('presentationTime="20" duration="5" id="2"', 'AAAA')}
        </EventStream>
        <EventStream schemeIdUri="urn:example:other">
            <Event presentationTime="40" duration="5" id="3"/>
        </EventStream>
    </Period>`),
                BASE
            )
            expect(breaks.map((b) => b.id)).toEqual(['2'])
            expect(breaks[0].signal?.scte35).toEqual([])
        })

        it('does not repeat an avail signalled in each ad Period', () => {
            const binary = spliceInsertBase64({
                eventId: 1,
                outOfNetwork: true,
            })
            const stream = (pto: number) => `
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}" presentationTimeOffset="${pto}">
            ${xmlBinEvent('presentationTime="60" duration="10" id="1"', binary)}
        </EventStream>`
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period id="c" start="PT0S" duration="PT60S"/>
    <Period id="a" start="PT60S" duration="PT5S">${stream(60)}</Period>
    <Period id="b" start="PT65S" duration="PT5S">${stream(65)}</Period>
    <Period id="c2" start="PT70S"/>`),
                BASE,
                120
            )
            expect(breaks.length).toBe(1)
            expect(breaks[0].ads).toEqual([
                { id: 'a', startTime: 60, duration: 5, uri: null },
                { id: 'b', startTime: 65, duration: 5, uri: null },
            ])
        })

        it('classifies stitched pre-rolls and post-rolls', () => {
            const binary = spliceInsertBase64({
                eventId: 1,
                outOfNetwork: true,
            })
            const breaks = discoverDashAdBreaks(
                mpd(
                    `
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashScte35Scheme.XML_BIN}">
            ${xmlBinEvent('presentationTime="0" duration="10" id="pre"', binary)}
            ${xmlBinEvent('presentationTime="50" duration="10" id="post"', binary)}
        </EventStream>
    </Period>`,
                    'PT60S'
                ),
                BASE,
                60
            )
            expect(breaks.map((b) => b.placement)).toEqual([
                'preroll',
                'postroll',
            ])
        })
    })

    describe('alternative MPD', () => {
        it('maps insert events to interstitial breaks', () => {
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashAlternativeMpdScheme.INSERT}" timescale="1000">
            <Event presentationTime="0" id="1">
                <InsertPresentation uri="../ad_preroll/stream.mpd"/>
            </Event>
            <Event presentationTime="60000" id="2">
                <InsertPresentation uri="https://ads.example.com/mid.mpd"
                    maxDuration="15000" earliestResolutionTimeOffset="10000"/>
            </Event>
            <Event presentationTime="120000" id="3">
                <InsertPresentation uri="post.mpd"/>
            </Event>
        </EventStream>
    </Period>`),
                BASE,
                120
            )
            expect(breaks.map((b) => b.placement)).toEqual([
                'preroll',
                'midroll',
                'postroll',
            ])
            expect(breaks[0].ads).toEqual([
                {
                    id: '1-0',
                    startTime: 0,
                    duration: null,
                    uri: 'https://cdn.example.com/ad_preroll/stream.mpd',
                },
            ])
            expect(breaks[1]).toEqual(
                jasmine.objectContaining({
                    id: '2',
                    startTime: 60,
                    duration: null,
                    insertion: 'interstitial',
                    resumeOffset: 0,
                    playoutLimit: 15,
                    resolutionTimeOffset: 10,
                    once: false,
                    restrict: {},
                    skipControl: null,
                    signal: {
                        source: 'dash-alternative-mpd',
                        schemeIdUri: DashAlternativeMpdScheme.INSERT,
                        scte35: [],
                    },
                })
            )
        })

        it('maps replace events, resuming at the return offset', () => {
            const breaks = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT10S">
        <EventStream schemeIdUri="${DashAlternativeMpdScheme.REPLACE}" timescale="1000" presentationTimeOffset="10000">
            <Event presentationTime="60000" duration="15000" id="1">
                <ReplacePresentation uri="mid.mpd" returnOffset="12000" maxDuration="15000"/>
            </Event>
            <Event presentationTime="90000" duration="5000" id="2">
                <ReplacePresentation uri="mid.mpd"/>
            </Event>
            <Event presentationTime="100000">
                <ReplacePresentation uri="mid.mpd"/>
            </Event>
        </EventStream>
    </Period>`),
                BASE
            )
            expect(
                breaks.map((b) => [
                    b.id,
                    b.startTime,
                    b.duration,
                    b.resumeOffset,
                ])
            ).toEqual([
                ['1', 60, 15, 12],
                ['2', 90, 5, 5],
                ['100', 100, null, 0],
            ])
        })

        it('defaults the timescale to seconds', () => {
            const [adBreak] = discoverDashAdBreaks(
                mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashAlternativeMpdScheme.REPLACE}">
            <Event presentationTime="30" duration="10" id="1">
                <ReplacePresentation uri="x.mpd" returnOffset="8" maxDuration="10"/>
            </Event>
        </EventStream>
    </Period>`),
                BASE
            )
            expect(adBreak).toEqual(
                jasmine.objectContaining({
                    startTime: 30,
                    resumeOffset: 8,
                    playoutLimit: 10,
                })
            )
        })

        it('ignores events without a presentation uri', () => {
            expect(
                discoverDashAdBreaks(
                    mpd(`
    <Period id="p0" start="PT0S">
        <EventStream schemeIdUri="${DashAlternativeMpdScheme.INSERT}">
            <Event presentationTime="10" id="1"><ReplacePresentation uri="x.mpd"/></Event>
            <Event presentationTime="20" id="2"><InsertPresentation/></Event>
        </EventStream>
    </Period>`),
                    BASE
                )
            ).toEqual([])
        })
    })

    describe('spliceInfoSectionFromXml', () => {
        it('converts time signals with segmentation descriptors', () => {
            expect(
                spliceInfoSectionFromXml({
                    TimeSignal: { SpliceTime: { ptsTime: 90000 } },
                    SegmentationDescriptor: [
                        {
                            segmentationEventId: 9,
                            segmentationDuration: 180000,
                            segmentationTypeId: 0x34,
                            segmentNum: 1,
                            segmentsExpected: 2,
                            SegmentationUpid: [
                                {
                                    segmentationUpidType: 0x0c,
                                    segmentationUpidFormat: 'text',
                                    _content: 'ab',
                                },
                            ],
                        },
                        {
                            SegmentationUpid: [{ _content: '0x0A0b' }],
                        },
                        {
                            SegmentationUpid: [{ _content: 'xyz' }],
                        },
                        {},
                    ],
                })
            ).toEqual({
                ptsAdjustment: 0,
                tier: 0xfff,
                encrypted: false,
                command: { type: 'timeSignal', spliceTime: 90000 },
                descriptors: [
                    {
                        type: 'segmentation',
                        segmentationEventId: 9,
                        cancel: false,
                        segmentationDuration: 180000,
                        upidType: 0x0c,
                        upid: new Uint8Array([0x61, 0x62]),
                        segmentationTypeId: 0x34,
                        segmentNum: 1,
                        segmentsExpected: 2,
                    },
                    jasmine.objectContaining({
                        upid: new Uint8Array([0x0a, 0x0b]),
                    }),
                    jasmine.objectContaining({
                        upid: new Uint8Array([0x78, 0x79, 0x7a]),
                    }),
                    jasmine.objectContaining({
                        segmentationEventId: 0,
                        upid: new Uint8Array(0),
                    }),
                ],
            })
        })

        it('converts splice null, empty, and unknown commands', () => {
            expect(
                spliceInfoSectionFromXml({ SpliceNull: {} }).command
            ).toEqual({
                type: 'spliceNull',
            })
            expect(
                spliceInfoSectionFromXml({ TimeSignal: {} }).command
            ).toEqual({ type: 'timeSignal', spliceTime: null })
            expect(spliceInfoSectionFromXml({}).command).toEqual({
                type: 'unknown',
                commandType: 0xff,
            })
            expect(
                spliceInfoSectionFromXml({
                    SpliceInsert: { BreakDuration: {} },
                }).command
            ).toEqual(
                jasmine.objectContaining({
                    spliceEventId: 0,
                    spliceTime: null,
                    breakDuration: null,
                })
            )
            expect(
                spliceInfoSectionFromXml({
                    SpliceInsert: { BreakDuration: { duration: 5 } },
                }).command
            ).toEqual(
                jasmine.objectContaining({
                    breakDuration: { autoReturn: false, duration: 5 },
                })
            )
        })
    })
})
