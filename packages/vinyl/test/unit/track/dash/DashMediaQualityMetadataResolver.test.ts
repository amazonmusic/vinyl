/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ContentProtectionScheme,
    parseDashManifest,
    type RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import {
    contentProtectionToMetadata,
    createDefaultDashMediaQualityMetadataResolver,
    createMediaQualityMetadataFromDashRepresentation,
    type DashMediaQualityMetadataResolver,
    defaultDrmKeySystemResolver,
    DrmKeySystem,
    type DrmKeySystemResolver,
    estimatePeakBandwidth,
    flattenRepresentations,
    getPeriodSortedBandwidths,
    type MediaQualityMetadata,
} from '@amazon/vinyl'
import { ValidationError } from '@amazon/vinyl-util'
import objectContaining = jasmine.objectContaining
import any = jasmine.any
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

// language=XML
const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="1" contentType="audio" codecs="flac">
                            <SupplementalProperty schemeIdUri="a" value="value1"/>
                            <ContentProtection schemeIdUri="urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2"/>
                            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/>
                            <ContentProtection schemeIdUri="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95"/>
                            <Representation bandwidth="1" id="a">
                                <SupplementalProperty schemeIdUri="a" value="value2"/>
                                <SupplementalProperty schemeIdUri="b" value="value3" id="idB"/>
                            </Representation>
                            <Representation bandwidth="2" id="b">
                                <SupplementalProperty schemeIdUri="c"/>
                            </Representation>
                            <Representation bandwidth="3" id="c"/>
                        </AdaptationSet>
                        <AdaptationSet id="2" bitstreamSwitching="true" mimeType="audio/mpeg" codecs="opus">
                            <Representation bandwidth="3" id="a"/>
                            <Representation bandwidth="4" id="b"/>
                            <Representation bandwidth="5" id="c"/>
                        </AdaptationSet>
                        <AdaptationSet id="3" bitstreamSwitching="true" mimeType="audio/mpeg" codecs="mp4a.40.5">
                            <Representation bandwidth="3" id="a"/>
                            <Representation bandwidth="4" id="b"/>
                            <Representation bandwidth="5" id="c"/>
                        </AdaptationSet>
                    </Period>
                    <Period>
                        <AdaptationSet id="1" contentType="audio" codecs="flac">
                            <Representation bandwidth="1" id="a"/>
                            <Representation bandwidth="2" id="b"/>
                            <Representation bandwidth="3" id="c"/>
                        </AdaptationSet>
                        <AdaptationSet id="2" bitstreamSwitching="true" mimeType="audio/mpeg" codecs="opus">
                            <Representation bandwidth="3" id="a"/>
                            <Representation bandwidth="4" id="b"/>
                            <Representation bandwidth="5" id="c"/>
                        </AdaptationSet>
                        <AdaptationSet id="3" bitstreamSwitching="true" mimeType="audio/mpeg" codecs="mp4a.40.5">
                            <Representation bandwidth="3" id="a"/>
                            <Representation bandwidth="4" id="b"/>
                            <Representation bandwidth="5" id="c"/>
                        </AdaptationSet>
                    </Period>
                </MPD>`)

describe('createDefaultDashMediaQualityMetadataResolver', () => {
    let drmKeySystemResolver: Spy<DrmKeySystemResolver>
    let resolver: DashMediaQualityMetadataResolver

    beforeEach(() => {
        drmKeySystemResolver = createSpy('drmKeySystemResolver').and.callFake(
            defaultDrmKeySystemResolver
        )
        resolver = createDefaultDashMediaQualityMetadataResolver({
            drmKeySystemResolver,
        })
    })

    it('memoizes results by representation reference', () => {
        const p0_a0_r0 = resolver(
            manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
        )
        const p0_a0_r1 = resolver(
            manifest.MPD.Period[0].AdaptationSet![0].Representation![1]
        )
        expect(
            resolver(
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
            )
        ).toBe(p0_a0_r0)
        expect(
            resolver(
                manifest.MPD.Period[0].AdaptationSet![0].Representation![1]
            )
        ).toBe(p0_a0_r1)
        expect(p0_a0_r0).not.toEqual(p0_a0_r1)
    })
})

describe('createMediaQualityMetadataFromDashRepresentation', () => {
    let drmKeySystemResolver: Spy<DrmKeySystemResolver>
    let repToMetadata: DashMediaQualityMetadataResolver

    beforeEach(() => {
        drmKeySystemResolver = createSpy('drmKeySystemResolver').and.callFake(
            defaultDrmKeySystemResolver
        )
        repToMetadata = (rep: RepresentationType) =>
            createMediaQualityMetadataFromDashRepresentation(rep, {
                drmKeySystemResolver,
            })
    })

    it('provides MediaEncodingMetadata attributes for the given representation', () => {
        drmKeySystemResolver.and.returnValues(
            [DrmKeySystem.FAIR_PLAY],
            [DrmKeySystem.WIDEVINE],
            [DrmKeySystem.PLAY_READY]
        )
        const p0_a0_r0 = repToMetadata(
            manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
        )
        expect(p0_a0_r0).toEqual(
            objectContaining<MediaQualityMetadata>({
                qualityId: any(String),
                decoderId: any(String),
                contentType: 'audio',
                mimeType: 'audio/mp4; codecs="flac"',
                bandwidth: 1,
                supplementalProperties: {
                    a: [
                        { id: null, value: 'value1' },
                        { id: null, value: 'value2' },
                    ],
                    b: [{ id: 'idB', value: 'value3' }],
                },
                contentProtections: [
                    {
                        keySystem: DrmKeySystem.FAIR_PLAY,
                        pssh: null,
                        pro: null,
                    },
                    {
                        keySystem: DrmKeySystem.WIDEVINE,
                        pssh: null,
                        pro: null,
                    },
                    {
                        keySystem: DrmKeySystem.PLAY_READY,
                        pssh: null,
                        pro: null,
                    },
                ],
            })
        )

        drmKeySystemResolver.and.returnValue([])
        const p0_a0_r1 = repToMetadata(
            manifest.MPD.Period[0].AdaptationSet![0].Representation![1]
        )
        expect(p0_a0_r1).toEqual(
            objectContaining<MediaQualityMetadata>({
                qualityId: any(String),
                decoderId: any(String),
                contentType: 'audio',
                mimeType: 'audio/mp4; codecs="flac"',
                bandwidth: 2,
                contentProtections: [],
                supplementalProperties: {
                    a: [{ id: null, value: 'value1' }],
                    c: [{ id: null, value: null }],
                },
            })
        )

        const p0_a1_r0 = repToMetadata(
            manifest.MPD.Period[0].AdaptationSet![1].Representation![0]
        )
        expect(p0_a1_r0).toEqual(
            objectContaining<MediaQualityMetadata>({
                contentProtections: [],
            })
        )
    })

    it('provides quality ids unique to the manifest', () => {
        const allRepresentations = [
            ...flattenRepresentations(manifest.MPD.Period[0]),
            ...flattenRepresentations(manifest.MPD.Period[1]),
        ]
        const set = new Set<string>()
        for (const representation of allRepresentations) {
            const qualityId = repToMetadata(representation).qualityId
            expect(set.has(qualityId))
                .withContext(`duplicate qualityId: ${qualityId}`)
                .toBeFalse()
            set.add(qualityId)
        }
        expect(set.size).toEqual(18)
    })

    describe(`when the representation's adaptation set bitstreamSwitching is not true`, () => {
        it('does not share decoder ids', () => {
            const adaptationSet0 = manifest.MPD.Period[0].AdaptationSet![0]
            expect(adaptationSet0.bitstreamSwitching).toBeUndefined()
            const encodingMetadata =
                adaptationSet0.Representation!.map(repToMetadata)
            expect(encodingMetadata[0].decoderId).not.toEqual(
                encodingMetadata[1].decoderId
            )
            expect(encodingMetadata[1].decoderId).not.toEqual(
                encodingMetadata[2].decoderId
            )
        })
    })

    describe(`when the representation's adaptation set bitstreamSwitching is true`, () => {
        it('shares decoder ids', () => {
            const adaptationSet0 = manifest.MPD.Period[0].AdaptationSet![1]
            expect(adaptationSet0.bitstreamSwitching).toBeTrue()
            const encodingMetadata =
                adaptationSet0.Representation!.map(repToMetadata)
            expect(encodingMetadata[0].decoderId).toEqual(
                encodingMetadata[1].decoderId
            )
            expect(encodingMetadata[1].decoderId).toEqual(
                encodingMetadata[2].decoderId
            )
        })
    })

    describe('adaptation set switching', () => {
        it('returns own groupId in switchingGroupIds when no switching property', () => {
            const rep =
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
            const meta = repToMetadata(rep)
            expect(meta.switchingGroupIds).toEqual([meta.groupId])
        })

        it('resolves switchingGroupIds from switching property', () => {
            // language=XML
            const m = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="0" mimeType="audio/mp4" codecs="flac">
                            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="1"/>
                            <Representation bandwidth="1" id="a"/>
                        </AdaptationSet>
                        <AdaptationSet id="1" mimeType="audio/mp4" codecs="opus">
                            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="0"/>
                            <Representation bandwidth="2" id="b"/>
                        </AdaptationSet>
                    </Period>
                </MPD>`)
            const r0 = repToMetadata(
                m.MPD.Period[0].AdaptationSet![0].Representation![0]
            )
            const r1 = repToMetadata(
                m.MPD.Period[0].AdaptationSet![1].Representation![0]
            )
            expect(r0.switchingGroupIds).toContain(r0.groupId)
            expect(r0.switchingGroupIds).toContain(r1.groupId)
            expect(r1.switchingGroupIds).toContain(r0.groupId)
            expect(r1.switchingGroupIds).toContain(r1.groupId)
        })

        it('returns only self groupId when switching property value is empty', () => {
            // language=XML
            const m = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="0" mimeType="audio/mp4" codecs="flac">
                            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value=""/>
                            <Representation bandwidth="1" id="a"/>
                        </AdaptationSet>
                    </Period>
                </MPD>`)
            const r = repToMetadata(
                m.MPD.Period[0].AdaptationSet![0].Representation![0]
            )
            expect(r.switchingGroupIds).toEqual([r.groupId])
        })
    })
    describe('when ContentProtection is set with cenc scheme id', () => {
        describe('and value is not set', () => {
            it('sets encryptionScheme to null', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="1" contentType="audio" codecs="flac">
                            <Representation bandwidth="1" id="a">
                                <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011"/>
                            </Representation>
                        </AdaptationSet>
                    </Period>
                </MPD>`)
                expect(
                    repToMetadata(
                        manifest.MPD.Period[0].AdaptationSet![0]
                            .Representation![0]
                    ).encryptionScheme
                ).toBeNull()
            })
        })

        describe('and value is a valid mp4 protection scheme', () => {
            it('sets encryptionScheme to the protection scheme', () => {
                // language=XML
                const manifest = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="1" contentType="audio" codecs="flac">
                            <Representation bandwidth="1" id="a">
                                <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc:3"/>
                            </Representation>
                        </AdaptationSet>
                    </Period>
                </MPD>`)
                expect(
                    repToMetadata(
                        manifest.MPD.Period[0].AdaptationSet![0]
                            .Representation![0]
                    ).encryptionScheme
                ).toBe('cenc')
            })
        })
    })

    it('throws when mimeType cannot be inferred', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet id="1">
                        <Representation bandwidth="1" id="a"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        expect(() =>
            repToMetadata(m.MPD.Period[0].AdaptationSet![0].Representation![0])
        ).toThrowMatching(
            (e) =>
                e instanceof ValidationError &&
                e.message === 'mimeType cannot be inferred'
        )
    })

    describe('lang property', () => {
        it('sets lang from adaptationSet.lang when present', () => {
            // language=XML
            const manifestWithLang = parseDashManifest(`<?xml version="1.0" ?>
                <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period>
                        <AdaptationSet id="1" contentType="audio" lang="en-US">
                            <Representation bandwidth="1" id="a"/>
                        </AdaptationSet>
                    </Period>
                </MPD>`)

            const metadata = repToMetadata(
                manifestWithLang.MPD.Period[0].AdaptationSet![0]
                    .Representation![0]
            )

            expect(metadata.lang).toBe('en-US')
        })

        it('sets lang to null when adaptationSet.lang is not present', () => {
            const metadata = repToMetadata(
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0]
            )

            expect(metadata.lang).toBe(null)
        })
    })
})

describe('getPeriodSortedBandwidths', () => {
    it('returns sorted descending bandwidths per content type', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="video/mp4" codecs="avc1.640015">
                        <Representation bandwidth="500000" id="v1"/>
                        <Representation bandwidth="1000000" id="v2"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="64000" id="a1"/>
                        <Representation bandwidth="128000" id="a2"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('video')).toEqual([1000000, 500000])
        expect(result.get('audio')).toEqual([128000, 64000])
        expect(result.size).toBe(2)
    })

    it('returns a single entry for a single content type period', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="128000" id="a1"/>
                        <Representation bandwidth="256000" id="a2"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('audio')).toEqual([256000, 128000])
        expect(result.size).toBe(1)
    })

    it('merges bandwidths across adaptation sets of the same content type', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="128000" id="a1"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="audio/mp4" codecs="flac">
                        <Representation bandwidth="256000" id="a2"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('audio')).toEqual([256000, 128000])
        expect(result.size).toBe(1)
    })

    it('collapses bandwidths within 10% of each other', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="100000" id="a1"/>
                        <Representation bandwidth="95000" id="a2"/>
                        <Representation bandwidth="50000" id="a3"/>
                        <Representation bandwidth="48000" id="a4"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        // 95000 is 5% below 100000 → collapsed
        // 48000 is 4% below 50000 → collapsed
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('audio')).toEqual([100000, 50000])
    })

    it('keeps bandwidths exactly 10% apart', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="100000" id="a1"/>
                        <Representation bandwidth="90000" id="a2"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        // 90000 is exactly 10% below 100000 → kept
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('audio')).toEqual([100000, 90000])
    })

    it('skips representations with unrecognizable content type', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="128000" id="a1"/>
                    </AdaptationSet>
                    <AdaptationSet>
                        <Representation bandwidth="999999" id="x1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('audio')).toEqual([128000])
        expect(result.size).toBe(1)
    })

    it('returns an empty map for a period with no adaptation sets', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period/>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.size).toBe(0)
    })

    it('returns an empty map for a period with no recognizable content types', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet>
                        <Representation bandwidth="100" id="x1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.size).toBe(0)
    })

    it('skips adaptation sets with no representations', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="video/mp4" codecs="avc1.640015"/>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="128000" id="a1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const result = getPeriodSortedBandwidths(m.MPD.Period[0])
        expect(result.get('audio')).toEqual([128000])
        expect(result.has('video')).toBeFalse()
    })
})

describe('estimatePeakBandwidth', () => {
    it('pairs proportionally when video has more qualities than audio', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="video/mp4" codecs="avc1.640015">
                        <Representation bandwidth="4000" id="v1"/>
                        <Representation bandwidth="3000" id="v2"/>
                        <Representation bandwidth="2000" id="v3"/>
                        <Representation bandwidth="1000" id="v4"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="200" id="a1"/>
                        <Representation bandwidth="100" id="a2"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        const as0 = m.MPD.Period[0].AdaptationSet![0]
        const as1 = m.MPD.Period[0].AdaptationSet![1]
        // video sorted: [4000, 3000, 2000, 1000], audio sorted: [200, 100]
        // v1 pos=0/3=0.00 → audio index round(0.00*1)=0 → 200. total=4200
        expect(estimatePeakBandwidth(as0.Representation![0], 'video')).toBe(
            4200
        )
        // v2 pos=1/3=0.33 → audio index round(0.33*1)=0 → 200. total=3200
        expect(estimatePeakBandwidth(as0.Representation![1], 'video')).toBe(
            3200
        )
        // v3 pos=2/3=0.67 → audio index round(0.67*1)=1 → 100. total=2100
        expect(estimatePeakBandwidth(as0.Representation![2], 'video')).toBe(
            2100
        )
        // v4 pos=3/3=1.00 → audio index round(1.00*1)=1 → 100. total=1100
        expect(estimatePeakBandwidth(as0.Representation![3], 'video')).toBe(
            1100
        )
        // a1 pos=0/1=0 → video index round(0*3)=0 → 4000. total=4200
        expect(estimatePeakBandwidth(as1.Representation![0], 'audio')).toBe(
            4200
        )
        // a2 pos=1/1=1 → video index round(1*3)=3 → 1000. total=1100
        expect(estimatePeakBandwidth(as1.Representation![1], 'audio')).toBe(
            1100
        )
    })

    it('returns bandwidth as-is for single content type periods', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="128000" id="a1"/>
                        <Representation bandwidth="256000" id="a2"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        // No sibling types, so bandwidthTotal = bandwidth
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![0],
                'audio'
            )
        ).toBe(128000)
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![1],
                'audio'
            )
        ).toBe(256000)
    })

    it('returns raw bandwidth when content type is not in the period', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet>
                        <Representation bandwidth="50000" id="x1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![0],
                'text'
            )
        ).toBe(50000)
    })

    it('pairs proportionally with three content types', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="video/mp4" codecs="avc1.640015">
                        <Representation bandwidth="2000" id="v1"/>
                        <Representation bandwidth="1000" id="v2"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="200" id="a1"/>
                        <Representation bandwidth="100" id="a2"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="text/vtt" contentType="text">
                        <Representation bandwidth="10" id="t1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        // v1 pos=0 → audio[0]=200, text[0]=10. total=2210
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![0],
                'video'
            )
        ).toBe(2210)
        // v2 pos=1 → audio[1]=100, text[0]=10. total=1110
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![1],
                'video'
            )
        ).toBe(1110)
        // t1 pos=0 (only 1 text) → video[0]=2000, audio[0]=200. total=2210
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![2].Representation![0],
                'text'
            )
        ).toBe(2210)
    })

    it('handles single quality per content type', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="video/mp4" codecs="avc1.640015">
                        <Representation bandwidth="1000" id="v1"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="100" id="a1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        // Only one quality each, position=0 for both
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![0],
                'video'
            )
        ).toBe(1100)
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![1].Representation![0],
                'audio'
            )
        ).toBe(1100)
    })

    it('handles bandwidth collapsed by 10% dedup threshold', () => {
        // language=XML
        const m = parseDashManifest(`<?xml version="1.0" ?>
            <MPD minBufferTime="PT0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                <Period>
                    <AdaptationSet mimeType="video/mp4" codecs="avc1.640015">
                        <Representation bandwidth="100000" id="v1"/>
                        <Representation bandwidth="95000" id="v2"/>
                    </AdaptationSet>
                    <AdaptationSet mimeType="audio/mp4" codecs="mp4a.40.2">
                        <Representation bandwidth="200" id="a1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)
        // 95000 is within 10% of 100000, so video sorted bandwidths = [100000].
        // v2's exact bandwidth is not in the array, but should still resolve.
        expect(
            estimatePeakBandwidth(
                m.MPD.Period[0].AdaptationSet![0].Representation![1],
                'video'
            )
        ).toBe(95200)
    })
})

describe('contentProtectionToMetadata', () => {
    it('returns a list of DrmProtection objects for each key system returned by the drmKeySystemResolver', () => {
        expect(
            contentProtectionToMetadata(
                {
                    schemeIdUri: ContentProtectionScheme.FAIR_PLAY,
                    pssh: { _content: 'abc' },
                },
                {
                    drmKeySystemResolver: () => [
                        DrmKeySystem.FAIR_PLAY,
                        DrmKeySystem.FAIR_PLAY_1_0,
                    ],
                }
            )
        ).toEqual([
            {
                keySystem: DrmKeySystem.FAIR_PLAY,
                pssh: 'abc',
                pro: null,
            },
            {
                keySystem: DrmKeySystem.FAIR_PLAY_1_0,
                pssh: 'abc',
                pro: null,
            },
        ])
        expect(
            contentProtectionToMetadata(
                {
                    schemeIdUri: ContentProtectionScheme.PLAY_READY,
                    pssh: { _content: 'abc' },
                    pro: { _content: 'def' },
                },
                {
                    drmKeySystemResolver: () => [
                        DrmKeySystem.PLAY_READY_RECOMMENDATION,
                        DrmKeySystem.PLAY_READY,
                    ],
                }
            )
        ).toEqual([
            {
                keySystem: DrmKeySystem.PLAY_READY_RECOMMENDATION,
                pssh: 'abc',
                pro: 'def',
            },
            {
                keySystem: DrmKeySystem.PLAY_READY,
                pssh: 'abc',
                pro: 'def',
            },
        ])

        expect(
            contentProtectionToMetadata(
                {
                    schemeIdUri: ContentProtectionScheme.WIDEVINE,
                    pssh: { _content: 'abc' },
                },
                {
                    drmKeySystemResolver: () => [],
                }
            )
        ).toEqual([])
    })
})
