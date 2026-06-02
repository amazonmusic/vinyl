/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    calculateDuration,
    calculatePeriodEnd,
    calculatePeriodStart,
    calculatePeriodTimeRange,
    flattenRepresentations,
    getPeriodAtTime,
    getRepresentationAncestry,
    getSegmentBase,
    getSegmentList,
    getSegmentTemplate,
    sampleToMpdTime,
} from '@amazon/vinyl'
import { clone, toJson } from '@amazon/vinyl-util'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { mockDashManifest } from '@amazon/vinyl/vinylTestUtil'
import objectContaining = jasmine.objectContaining

describe('mpd utils', () => {
    describe('getSegmentList', () => {
        it('combines inherited properties', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <SegmentList actuate="onRequest" duration="20S"/>
                    <AdaptationSet>
                        <SegmentList startNumber="1"/>
                        <Representation id="0" bandwidth="2345">
                            <SegmentList actuate="onLoad">
                                <SegmentURL media="mediaExample"/>
                            </SegmentList>
                        </Representation>
                    </AdaptationSet>
                </Period>
            </MPD>`)
            const rep =
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
            expect(toJson(getSegmentList(rep))).toEqual({
                actuate: 'onLoad',
                duration: 20,
                indexRangeExact: false,
                startNumber: 1,
                SegmentURL: [{ media: 'mediaExample' }],
            })
        })

        describe('when undefined at each scope', () => {
            it('returns undefined', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet>
                        <Representation id="0" bandwidth="2345"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
                const rep =
                    manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
                expect(getSegmentList(rep)).toBeUndefined()
            })
        })
    })

    describe('getSegmentTemplate', () => {
        it('combines inherited properties', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
<MPD mediaPresentationDuration="25S" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period start="0S">
      <SegmentTemplate bitstreamSwitching="true"/>
      <AdaptationSet>
          <SegmentTemplate media="adaptationSetMedia" initialization="adaptationSetInitialization"/>
          <Representation id="0" bandwidth="2345">
              <SegmentTemplate media="representationSetMedia"/>
          </Representation>
      </AdaptationSet>
  </Period>
</MPD>`)
            const rep =
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
            expect(toJson(getSegmentTemplate(rep))).toEqual({
                bitstreamSwitching: 'true',
                indexRangeExact: false,
                media: 'representationSetMedia',
                initialization: 'adaptationSetInitialization',
            })
        })
    })

    describe('getSegmentBase', () => {
        it('combines inherited properties', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
            <MPD mediaPresentationDuration="25S" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period start="0S">
                    <SegmentBase indexRange="123-456" duration="20S"/>
                    <AdaptationSet>
                        <SegmentBase presentationTimeOffset="2456"/>
                        <Representation id="0" bandwidth="2345">
                            <SegmentBase>
                                <Initialization range="111-222"/>
                            </SegmentBase>
                        </Representation>
                    </AdaptationSet>
                </Period>
            </MPD>`)
            const rep =
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
            expect(toJson(getSegmentBase(rep))).toEqual({
                indexRange: [123, 456],
                indexRangeExact: false,
                presentationTimeOffset: 2456,
                Initialization: {
                    range: [111, 222],
                },
            })
        })
    })

    describe('calculatePeriodTimeRange', () => {
        it('returns the start and end presentation time range of the given period', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
<MPD mediaPresentationDuration="25S" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period start="0S"/>
  <Period start="11S"/>
  <Period start="13S"/>
  <Period start="18S"/>
</MPD>`)
            expect(manifest.MPD.Period.map(calculatePeriodTimeRange)).toEqual([
                [0, 11],
                [11, 13],
                [13, 18],
                [18, 25],
            ])
        })
    })

    describe('calculatePeriodStart', () => {
        describe('when period.start is defined', () => {
            it('uses period.start', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD mediaPresentationDuration="25S" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period start="0S"/>
                    <Period start="11S"/>
                    <Period start="13S"/>
                    <Period start="18S"/>
                </MPD>`)
                expect(manifest.MPD.Period.map(calculatePeriodStart)).toEqual([
                    0, 11, 13, 18,
                ])
            })
        })

        describe('when period.start is not defined', () => {
            it('returns 0', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
<MPD mediaPresentationDuration="PT5M0.0S" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period duration="10S"/>
</MPD>`)
                expect(calculatePeriodStart(manifest.MPD.Period[0])).toEqual(0)
            })
        })
    })

    describe('getPeriodAtTime', () => {
        it('returns the period spanning the given presentation time', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
            <MPD mediaPresentationDuration="60S" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period start="0S" id="0"/>
                <Period start="11S" id="1"/>
                <Period start="13S" id="2"/>
                <Period start="18S" id="3"/>
                <Period start="23S" id="4"/>
                <Period start="56S" id="5"/>
            </MPD>`)
            function id(time: number): string | null {
                return getPeriodAtTime(manifest, time)?.id ?? null
            }
            expect(id(-1)).toBeNull()
            expect(id(0)).toEqual('0')
            expect(id(10)).toEqual('0')
            expect(id(11)).toEqual('1')
            expect(id(55.99)).toEqual('4')
            expect(id(56)).toEqual('5')
            expect(id(59.99)).toEqual('5')
            expect(id(600)).toBeNull()
            expect(id(60)).toBeNull()
        })
    })

    describe('sampleToMpdTime', () => {
        it('converts a sample time to an MPD-relative time.', () => {
            expect(sampleToMpdTime(9000, 10, 3000, 1000)).toEqual(16)
        })
    })

    describe('getRepresentationAncestry', () => {
        it('returns the representation MPD, Period, AdaptationSet, Representation ancestry of a Representation', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
            <MPD id="m0" minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period id="p0">
                    <AdaptationSet id="0">
                        <Representation id="r0" bandwidth="1"/>
                        <Representation id="r1" bandwidth="1"/>
                    </AdaptationSet>
                    <AdaptationSet id="1">
                        <Representation id="r2" bandwidth="1"/>
                        <Representation id="r3" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
                <Period id="p1">
                    <AdaptationSet id="2">
                        <Representation id="r4" bandwidth="1"/>
                        <Representation id="r5" bandwidth="1"/>
                    </AdaptationSet>
                    <AdaptationSet id="3">
                        <Representation id="r6" bandwidth="1"/>
                        <Representation id="r7" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)

            expect(
                getRepresentationAncestry(
                    manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
                ).map((element) => element.id)
            ).toEqual([
                'm0',
                'p0',
                0, // To spec: adaptation sets use uint IDs
                'r0',
            ])

            expect(
                getRepresentationAncestry(
                    manifest.MPD.Period[1].AdaptationSet![1].Representation![1]
                ).map((element) => element.id)
            ).toEqual(['m0', 'p1', 3, 'r7'])
        })
    })

    describe('calculatePeriodEnd', () => {
        describe('when period start and duration are set', () => {
            it('returns period start plus duration', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period start="23" duration="30"/>
            </MPD>`)
                expect(calculatePeriodEnd(manifest.MPD.Period[0])).toEqual(53)
            })
        })

        describe('when period is not last', () => {
            it('returns start of next period', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period start="23"/>
                    <Period start="52"/>
                    <Period start="64"/>
                </MPD>`)
                expect(calculatePeriodEnd(manifest.MPD.Period[0])).toEqual(52)
                expect(calculatePeriodEnd(manifest.MPD.Period[1])).toEqual(64)
            })
        })

        describe('when period is last', () => {
            it('returns manifest presentation duration', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD mediaPresentationDuration="25S" minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period/>
                </MPD>`)
                expect(calculatePeriodEnd(manifest.MPD.Period[0])).toEqual(25)
            })

            describe('when the manifest presentation duration is not set', () => {
                it('returns null', () => {
                    // language=XML
                    const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period/>
                </MPD>`)
                    expect(
                        calculatePeriodEnd(manifest.MPD.Period[0])
                    ).toBeNull()
                })
            })
        })
    })

    describe('flattenRepresentations', () => {
        it('returns a flattened list of all representations across all periods', () => {
            // language=XML
            const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="1">
                            <Representation bandwidth="1" id="1a"/>
                            <Representation bandwidth="2" id="1b"/>
                        </AdaptationSet>
                        <AdaptationSet id="2">
                            <Representation bandwidth="3" id="2a"/>
                            <Representation bandwidth="4" id="2b"/>
                        </AdaptationSet>
                        <AdaptationSet id="3">
                            <Representation bandwidth="5" id="3a"/>
                            <Representation bandwidth="6" id="3b"/>
                        </AdaptationSet>
                    </Period>
                </MPD>`)

            expect(
                toJson(flattenRepresentations(manifest.MPD.Period[0]))
            ).toEqual(
                objectContaining([
                    { bandwidth: 1, id: '1a' },
                    { bandwidth: 2, id: '1b' },
                    { bandwidth: 3, id: '2a' },
                    { bandwidth: 4, id: '2b' },
                    { bandwidth: 5, id: '3a' },
                    { bandwidth: 6, id: '3b' },
                ])
            )
        })
    })

    describe('calculateDuration', () => {
        describe('when MPD.mediaPresentationDuration is set', () => {
            it('resolves to MPD.mediaPresentationDuration', () => {
                const manifest = clone(mockDashManifest)
                manifest.MPD.mediaPresentationDuration = 65
                expect(calculateDuration(manifest)).toBe(65)
            })
        })

        describe('when MPD.mediaPresentationDuration is not set', () => {
            it('resolves to calculated period end', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
<MPD minBufferTime="PT0.0S" profiles="urn:mpeg:dash:profile:isoff-live:2011" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period/>
  <Period start="20" duration="30">
  </Period>
</MPD>`)
                expect(calculateDuration(manifest)).toBe(50)
            })
        })

        describe('when MPD type is dynamic', () => {
            it('returns Infinity for live presentations', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
<MPD type="dynamic" minBufferTime="PT0.0S" profiles="urn:mpeg:dash:profile:isoff-live:2011" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period/>
</MPD>`)
                expect(calculateDuration(manifest)).toBe(Infinity)
            })
        })

        describe('when there are no periods', () => {
            it('throws', () => {
                const manifest = clone(mockDashManifest)
                delete (manifest.MPD as { mediaPresentationDuration?: number })
                    .mediaPresentationDuration
                ;(manifest.MPD as { Period: unknown }).Period = []
                expect(() => calculateDuration(manifest)).toThrowError(
                    /no periods/i
                )
            })
        })

        describe('when the last period has no determinable end', () => {
            it('throws', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
<MPD minBufferTime="PT0.0S" profiles="urn:mpeg:dash:profile:isoff-live:2011" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period/>
</MPD>`)
                expect(() => calculateDuration(manifest)).toThrowError(
                    /Unable to determine/
                )
            })
        })
    })
})
