/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type DashDrmManifest,
    parseDashManifest,
} from '@amazon/vinyl-mpd-parser'
import { dash_personalizedResponse } from '@amazon/vinyl-mpd-parser/dashTestAssets'
import { type OmitDeep, toJson } from '@amazon/vinyl-util'
import type { ReservedXmlRuleKeys } from '@amazon/vinyl-xml'

describe('parseDashManifest', () => {
    it('efficiently interprets a sizeable dash manifest with a tailored response', () => {
        const manifest = parseDashManifest(dash_personalizedResponse)
        expect<OmitDeep<DashDrmManifest, ReservedXmlRuleKeys>>(
            toJson(manifest)
        ).toEqual({
            MPD: {
                Period: [
                    {
                        AdaptationSet: [
                            {
                                AudioChannelConfiguration: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                        value: '1',
                                    },
                                ],
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412130844415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412130892544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412130940672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412130988799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131036928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412131085056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131132160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412131180288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412131228415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131276544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412131324672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412131372799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131420928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412131469056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131516160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412131564288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412131612415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131660544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412131708672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412131756799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131804928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412131853056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412131900160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412131948288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412131996415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412132044544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412132092672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412132140799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412132188928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412132237056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412132284160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412132332288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412132380415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412132428544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412132476672,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 0,
                                            startNumber: 1,
                                            timescale: 48000,
                                        },
                                        bandwidth: 69000,
                                        id: 'audio=69000',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                audioSamplingRate: [48000],
                                codecs: 'mp4a.40.2',
                                contentType: 'audio',
                                group: 1,
                                id: 1,
                                mimeType: 'audio/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 90000,
                                                        r: 34,
                                                        t: 139522745250000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 0,
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 700000,
                                        id: 'video=700000',
                                        scanType: 'progressive',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                codecs: 'avc1.64001F',
                                contentType: 'video',
                                group: 2,
                                height: 720,
                                id: 2,
                                mimeType: 'video/mp4',
                                par: [16, 9],
                                sar: [1, 1],
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                width: 1280,
                            },
                        ],
                        BaseURL: [
                            {
                                _content: 'dash/',
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '0.0',
                        start: 0,
                    },
                    {
                        AdaptationSet: [
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_1080p_10init.mp4',
                                            media: 'visitalps_1080p30_video_1080p_10_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 7500000,
                                        codecs: 'avc1.640028',
                                        height: 1080,
                                        id: '1',
                                        width: 1920,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_720p_9init.mp4',
                                            media: 'visitalps_1080p30_video_720p_9_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 3000000,
                                        codecs: 'avc1.64001f',
                                        height: 720,
                                        id: '2',
                                        width: 1280,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 270000,
                                                        r: 3,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_720p_8init.mp4',
                                            media: 'visitalps_1080p30_video_720p_8_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1875000,
                                        codecs: 'avc1.64001f',
                                        height: 720,
                                        id: '3',
                                        width: 1280,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_540p_7init.mp4',
                                            media: 'visitalps_1080p30_video_540p_7_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1500000,
                                        codecs: 'avc1.64001f',
                                        height: 540,
                                        id: '4',
                                        width: 960,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_6init.mp4',
                                            media: 'visitalps_1080p30_video_396p_6_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1012500,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '5',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_5init.mp4',
                                            media: 'visitalps_1080p30_video_396p_5_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 675000,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '6',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_4init.mp4',
                                            media: 'visitalps_1080p30_video_396p_4_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 450000,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '7',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_3init.mp4',
                                            media: 'visitalps_1080p30_video_288p_3_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 337500,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '8',
                                        width: 512,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_2init.mp4',
                                            media: 'visitalps_1080p30_video_288p_2_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 225000,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '9',
                                        width: 512,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_1init.mp4',
                                            media: 'visitalps_1080p30_video_288p_1_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 150000,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '10',
                                        width: 512,
                                    },
                                ],
                                SegmentTemplate: {
                                    indexRangeExact: false,
                                    startNumber: 1,
                                    timescale: 90000,
                                },
                                actuate: 'onRequest',
                                bitstreamSwitching: false,
                                frameRate: [30, 1],
                                mimeType: 'video/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: true,
                                subsegmentStartsWithSAP: 1,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 96000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 46368,
                                                        r: 0,
                                                        t: 672000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_audio_aac_128kinit.mp4',
                                            media: 'visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 48000,
                                        },
                                        audioSamplingRate: [48000],
                                        bandwidth: 128000,
                                        codecs: 'mp4a.40.2',
                                        id: '11',
                                    },
                                ],
                                SegmentTemplate: {
                                    indexRangeExact: false,
                                    initialization:
                                        'visitalps_1080p30_audio_aac_128kinit.mp4',
                                    media: 'visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4',
                                    startNumber: 1,
                                    timescale: 48000,
                                },
                                actuate: 'onRequest',
                                lang: 'eng',
                                mimeType: 'audio/mp4',
                                segmentAlignment: 0,
                                selectionPriority: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                        ],
                        BaseURL: [
                            {
                                _content:
                                    'http://d2gh0tfpz97e4o.cloudfront.net/visitalps/',
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550252760.0_1',
                        start: 1550252760,
                    },
                    {
                        AdaptationSet: [
                            {
                                AudioChannelConfiguration: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                        value: '1',
                                    },
                                ],
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133196544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412133244672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412133292799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133340928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412133389056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133436160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412133484288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412133532415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133580544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412133628672,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 74412133198368,
                                            timescale: 48000,
                                        },
                                        bandwidth: 69000,
                                        id: 'audio=69000',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                audioSamplingRate: [48000],
                                codecs: 'mp4a.40.2',
                                contentType: 'audio',
                                group: 1,
                                id: 1,
                                mimeType: 'audio/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 90000,
                                                        r: 9,
                                                        t: 139522749660000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 139522749746940,
                                            timescale: 90000,
                                        },
                                        bandwidth: 700000,
                                        id: 'video=700000',
                                        scanType: 'progressive',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                codecs: 'avc1.64001F',
                                contentType: 'video',
                                group: 2,
                                height: 720,
                                id: 2,
                                mimeType: 'video/mp4',
                                par: [16, 9],
                                sar: [1, 1],
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                width: 1280,
                            },
                        ],
                        BaseURL: [
                            {
                                _content: 'dash/',
                            },
                        ],
                        EventStream: [
                            {
                                Event: [
                                    {
                                        duration: 24,
                                        id: 136,
                                        presentationTime: 1550252760,
                                    },
                                ],
                                actuate: 'onRequest',
                                schemeIdUri: 'urn:scte:scte35:2014:xml+bin',
                                timescale: 1,
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550252760.0',
                        start: 1550252774.966,
                    },
                    {
                        AdaptationSet: [
                            {
                                AudioChannelConfiguration: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                        value: '1',
                                    },
                                ],
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412133676799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133724928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412133773056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133820160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412133868288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412133916415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412133964544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412134012672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412134060799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134108928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412134157056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134204160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412134252288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412134300415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134348544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412134396672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412134444799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134492928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412134541056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134588160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412134636288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412134684415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134732544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412134780672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412134828799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134876928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412134925056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412134972160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412135020288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412135068415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135116544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412135164672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412135212799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135260928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412135309056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135356160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412135404288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412135452415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135500544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412135548672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412135596799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135644928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412135693056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135740160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412135788288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412135836415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412135884544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412135932672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412135980799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136028928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412136077056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136124160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412136172288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412136220415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136268544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412136316672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412136364799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136412928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412136461056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136508160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412136556288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412136604415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136652544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412136700672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412136748799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136796928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412136845056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412136892160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412136940288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412136988415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137036544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412137084672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412137132799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137180928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412137229056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137276160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412137324288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412137372415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137420544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412137468672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412137516799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137564928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412137613056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137660160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412137708288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412137756415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137804544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412137852672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412137900799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412137948928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412137997056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412138044160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412138092288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412138140415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412138188544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412138236672,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 74412133632000,
                                            startNumber: 60,
                                            timescale: 48000,
                                        },
                                        bandwidth: 69000,
                                        id: 'audio=69000',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                audioSamplingRate: [48000],
                                codecs: 'mp4a.40.2',
                                contentType: 'audio',
                                group: 1,
                                id: 1,
                                mimeType: 'audio/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 90000,
                                                        r: 95,
                                                        t: 139522750560000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 139522750560000,
                                            startNumber: 60,
                                            timescale: 90000,
                                        },
                                        bandwidth: 700000,
                                        id: 'video=700000',
                                        scanType: 'progressive',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                codecs: 'avc1.64001F',
                                contentType: 'video',
                                group: 2,
                                height: 720,
                                id: 2,
                                mimeType: 'video/mp4',
                                par: [16, 9],
                                sar: [1, 1],
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                width: 1280,
                            },
                        ],
                        BaseURL: [
                            {
                                _content: 'dash/',
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550252784.0',
                        start: 1550252784,
                    },
                    {
                        AdaptationSet: [
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_1080p_10init.mp4',
                                            media: 'visitalps_1080p30_video_1080p_10_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 7500000,
                                        codecs: 'avc1.640028',
                                        height: 1080,
                                        id: '1',
                                        width: 1920,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_720p_9init.mp4',
                                            media: 'visitalps_1080p30_video_720p_9_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 3000000,
                                        codecs: 'avc1.64001f',
                                        height: 720,
                                        id: '2',
                                        width: 1280,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 270000,
                                                        r: 3,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_720p_8init.mp4',
                                            media: 'visitalps_1080p30_video_720p_8_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1875000,
                                        codecs: 'avc1.64001f',
                                        height: 720,
                                        id: '3',
                                        width: 1280,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_540p_7init.mp4',
                                            media: 'visitalps_1080p30_video_540p_7_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1500000,
                                        codecs: 'avc1.64001f',
                                        height: 540,
                                        id: '4',
                                        width: 960,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_6init.mp4',
                                            media: 'visitalps_1080p30_video_396p_6_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1012500,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '5',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_5init.mp4',
                                            media: 'visitalps_1080p30_video_396p_5_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 675000,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '6',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_4init.mp4',
                                            media: 'visitalps_1080p30_video_396p_4_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 450000,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '7',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_3init.mp4',
                                            media: 'visitalps_1080p30_video_288p_3_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 337500,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '8',
                                        width: 512,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_2init.mp4',
                                            media: 'visitalps_1080p30_video_288p_2_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 225000,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '9',
                                        width: 512,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_1init.mp4',
                                            media: 'visitalps_1080p30_video_288p_1_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 150000,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '10',
                                        width: 512,
                                    },
                                ],
                                SegmentTemplate: {
                                    indexRangeExact: false,
                                    startNumber: 1,
                                    timescale: 90000,
                                },
                                actuate: 'onRequest',
                                bitstreamSwitching: false,
                                frameRate: [30, 1],
                                mimeType: 'video/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: true,
                                subsegmentStartsWithSAP: 1,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 96000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 46368,
                                                        r: 0,
                                                        t: 672000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_audio_aac_128kinit.mp4',
                                            media: 'visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 48000,
                                        },
                                        audioSamplingRate: [48000],
                                        bandwidth: 128000,
                                        codecs: 'mp4a.40.2',
                                        id: '11',
                                    },
                                ],
                                SegmentTemplate: {
                                    indexRangeExact: false,
                                    initialization:
                                        'visitalps_1080p30_audio_aac_128kinit.mp4',
                                    media: 'visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4',
                                    startNumber: 1,
                                    timescale: 48000,
                                },
                                actuate: 'onRequest',
                                lang: 'eng',
                                mimeType: 'audio/mp4',
                                segmentAlignment: 0,
                                selectionPriority: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                        ],
                        BaseURL: [
                            {
                                _content:
                                    'http://d2gh0tfpz97e4o.cloudfront.net/visitalps/',
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550252880.0_1',
                        start: 1550252880,
                    },
                    {
                        AdaptationSet: [
                            {
                                AudioChannelConfiguration: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                        value: '1',
                                    },
                                ],
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412138956544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412139004672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412139052799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139100928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412139149056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139196160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412139244288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412139292415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139340544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412139388672,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 74412138958368,
                                            timescale: 48000,
                                        },
                                        bandwidth: 69000,
                                        id: 'audio=69000',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                audioSamplingRate: [48000],
                                codecs: 'mp4a.40.2',
                                contentType: 'audio',
                                group: 1,
                                id: 1,
                                mimeType: 'audio/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 90000,
                                                        r: 9,
                                                        t: 139522760460000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 139522760546940,
                                            timescale: 90000,
                                        },
                                        bandwidth: 700000,
                                        id: 'video=700000',
                                        scanType: 'progressive',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                codecs: 'avc1.64001F',
                                contentType: 'video',
                                group: 2,
                                height: 720,
                                id: 2,
                                mimeType: 'video/mp4',
                                par: [16, 9],
                                sar: [1, 1],
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                width: 1280,
                            },
                        ],
                        BaseURL: [
                            {
                                _content: 'dash/',
                            },
                        ],
                        EventStream: [
                            {
                                Event: [
                                    {
                                        duration: 24,
                                        id: 137,
                                        presentationTime: 1550252880,
                                    },
                                ],
                                actuate: 'onRequest',
                                schemeIdUri: 'urn:scte:scte35:2014:xml+bin',
                                timescale: 1,
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550252880.0',
                        start: 1550252894.966,
                    },
                    {
                        AdaptationSet: [
                            {
                                AudioChannelConfiguration: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                        value: '1',
                                    },
                                ],
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412139436799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139484928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412139533056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139580160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412139628288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412139676415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139724544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412139772672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412139820799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139868928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412139917056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412139964160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412140012288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412140060415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140108544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412140156672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412140204799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140252928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412140301056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140348160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412140396288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412140444415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140492544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412140540672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412140588799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140636928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412140685056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140732160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412140780288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412140828415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412140876544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412140924672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412140972799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141020928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412141069056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141116160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412141164288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412141212415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141260544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412141308672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412141356799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141404928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412141453056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141500160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412141548288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412141596415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141644544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412141692672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412141740799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141788928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412141837056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412141884160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412141932288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412141980415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142028544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412142076672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412142124799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142172928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412142221056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142268160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412142316288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412142364415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142412544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412142460672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412142508799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142556928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412142605056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142652160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412142700288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412142748415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142796544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412142844672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412142892799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412142940928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412142989056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143036160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412143084288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412143132415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143180544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412143228672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412143276799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143324928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412143373056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143420160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412143468288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412143516415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143564544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412143612672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412143660799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143708928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412143757056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143804160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412143852288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412143900415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412143948544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412143996672,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 74412139392000,
                                            startNumber: 180,
                                            timescale: 48000,
                                        },
                                        bandwidth: 69000,
                                        id: 'audio=69000',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                audioSamplingRate: [48000],
                                codecs: 'mp4a.40.2',
                                contentType: 'audio',
                                group: 1,
                                id: 1,
                                mimeType: 'audio/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 90000,
                                                        r: 95,
                                                        t: 139522761360000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 139522761360000,
                                            startNumber: 180,
                                            timescale: 90000,
                                        },
                                        bandwidth: 700000,
                                        id: 'video=700000',
                                        scanType: 'progressive',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                codecs: 'avc1.64001F',
                                contentType: 'video',
                                group: 2,
                                height: 720,
                                id: 2,
                                mimeType: 'video/mp4',
                                par: [16, 9],
                                sar: [1, 1],
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                width: 1280,
                            },
                        ],
                        BaseURL: [
                            {
                                _content: 'dash/',
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550252904.0',
                        start: 1550252904,
                    },
                    {
                        AdaptationSet: [
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_1080p_10init.mp4',
                                            media: 'visitalps_1080p30_video_1080p_10_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 7500000,
                                        codecs: 'avc1.640028',
                                        height: 1080,
                                        id: '1',
                                        width: 1920,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_720p_9init.mp4',
                                            media: 'visitalps_1080p30_video_720p_9_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 3000000,
                                        codecs: 'avc1.64001f',
                                        height: 720,
                                        id: '2',
                                        width: 1280,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 270000,
                                                        r: 3,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_720p_8init.mp4',
                                            media: 'visitalps_1080p30_video_720p_8_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1875000,
                                        codecs: 'avc1.64001f',
                                        height: 720,
                                        id: '3',
                                        width: 1280,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_540p_7init.mp4',
                                            media: 'visitalps_1080p30_video_540p_7_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1500000,
                                        codecs: 'avc1.64001f',
                                        height: 540,
                                        id: '4',
                                        width: 960,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_6init.mp4',
                                            media: 'visitalps_1080p30_video_396p_6_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 1012500,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '5',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_5init.mp4',
                                            media: 'visitalps_1080p30_video_396p_5_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 675000,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '6',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_396p_4init.mp4',
                                            media: 'visitalps_1080p30_video_396p_4_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 450000,
                                        codecs: 'avc1.64001e',
                                        height: 396,
                                        id: '7',
                                        width: 704,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_3init.mp4',
                                            media: 'visitalps_1080p30_video_288p_3_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 337500,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '8',
                                        width: 512,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 360000,
                                                        r: 2,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 266940,
                                                        r: 0,
                                                        t: 1080000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_2init.mp4',
                                            media: 'visitalps_1080p30_video_288p_2_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 225000,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '9',
                                        width: 512,
                                    },
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 180000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 86940,
                                                        r: 0,
                                                        t: 1260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_video_288p_1init.mp4',
                                            media: 'visitalps_1080p30_video_288p_1_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 90000,
                                        },
                                        bandwidth: 150000,
                                        codecs: 'avc1.640016',
                                        height: 288,
                                        id: '10',
                                        width: 512,
                                    },
                                ],
                                SegmentTemplate: {
                                    indexRangeExact: false,
                                    startNumber: 1,
                                    timescale: 90000,
                                },
                                actuate: 'onRequest',
                                bitstreamSwitching: false,
                                frameRate: [30, 1],
                                mimeType: 'video/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: true,
                                subsegmentStartsWithSAP: 1,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 96000,
                                                        r: 6,
                                                        t: 0,
                                                    },
                                                    {
                                                        d: 46368,
                                                        r: 0,
                                                        t: 672000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'visitalps_1080p30_audio_aac_128kinit.mp4',
                                            media: 'visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4',
                                            startNumber: 1,
                                            timescale: 48000,
                                        },
                                        audioSamplingRate: [48000],
                                        bandwidth: 128000,
                                        codecs: 'mp4a.40.2',
                                        id: '11',
                                    },
                                ],
                                SegmentTemplate: {
                                    indexRangeExact: false,
                                    initialization:
                                        'visitalps_1080p30_audio_aac_128kinit.mp4',
                                    media: 'visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4',
                                    startNumber: 1,
                                    timescale: 48000,
                                },
                                actuate: 'onRequest',
                                lang: 'eng',
                                mimeType: 'audio/mp4',
                                segmentAlignment: 0,
                                selectionPriority: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                        ],
                        BaseURL: [
                            {
                                _content:
                                    'http://d2gh0tfpz97e4o.cloudfront.net/visitalps/',
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550253000.0_1',
                        start: 1550253000,
                    },
                    {
                        AdaptationSet: [
                            {
                                AudioChannelConfiguration: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                        value: '1',
                                    },
                                ],
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412144716544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412144764672,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412144812799,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412144860928,
                                                    },
                                                    {
                                                        d: 47104,
                                                        r: 0,
                                                        t: 74412144909056,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412144956160,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412145004288,
                                                    },
                                                    {
                                                        d: 48129,
                                                        r: 0,
                                                        t: 74412145052415,
                                                    },
                                                    {
                                                        d: 48128,
                                                        r: 0,
                                                        t: 74412145100544,
                                                    },
                                                    {
                                                        d: 48127,
                                                        r: 0,
                                                        t: 74412145148672,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 74412144718368,
                                            timescale: 48000,
                                        },
                                        bandwidth: 69000,
                                        id: 'audio=69000',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                audioSamplingRate: [48000],
                                codecs: 'mp4a.40.2',
                                contentType: 'audio',
                                group: 1,
                                id: 1,
                                mimeType: 'audio/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                            },
                            {
                                Representation: [
                                    {
                                        SegmentTemplate: {
                                            SegmentTimeline: {
                                                S: [
                                                    {
                                                        d: 90000,
                                                        r: 9,
                                                        t: 139522771260000,
                                                    },
                                                ],
                                            },
                                            indexRangeExact: false,
                                            initialization:
                                                'scte35-$RepresentationID$.dash',
                                            media: 'scte35-$RepresentationID$-$Time$.dash',
                                            presentationTimeOffset: 139522771346940,
                                            timescale: 90000,
                                        },
                                        bandwidth: 700000,
                                        id: 'video=700000',
                                        scanType: 'progressive',
                                    },
                                ],
                                Role: [
                                    {
                                        schemeIdUri: 'urn:mpeg:dash:role:2011',
                                        value: 'main',
                                    },
                                ],
                                actuate: 'onRequest',
                                codecs: 'avc1.64001F',
                                contentType: 'video',
                                group: 2,
                                height: 720,
                                id: 2,
                                mimeType: 'video/mp4',
                                par: [16, 9],
                                sar: [1, 1],
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                width: 1280,
                            },
                        ],
                        BaseURL: [
                            {
                                _content: 'dash/',
                            },
                        ],
                        EventStream: [
                            {
                                Event: [
                                    {
                                        duration: 24,
                                        id: 138,
                                        presentationTime: 1550253000,
                                    },
                                ],
                                actuate: 'onRequest',
                                schemeIdUri: 'urn:scte:scte35:2014:xml+bin',
                                timescale: 1,
                            },
                        ],
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        id: '1550253000.0',
                        start: 1550253014.966,
                    },
                ],
                minBufferTime: 10,
                profiles: ['urn:mpeg:dash:profile:isoff-live:2011'],
                type: 'static',
            },
        })
    })
})
