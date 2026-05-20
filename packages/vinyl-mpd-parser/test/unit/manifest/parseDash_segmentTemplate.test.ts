/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { dash_segmentTemplate } from '@amazon/vinyl-mpd-parser/dashTestAssets'
import { type OmitDeep, toJson } from '@amazon/vinyl-util'
import type { ReservedXmlRuleKeys } from '@amazon/vinyl-xml'
import type { DashDrmManifest } from '@amazon/vinyl-mpd-parser'

describe('parseDashManifest segmentTemplate', () => {
    it('parses a manifest with segment templates at AdaptationSet and Representation levels', () => {
        const manifest = parseDashManifest(dash_segmentTemplate)
        expect<OmitDeep<DashDrmManifest, ReservedXmlRuleKeys>>(
            toJson(manifest)
        ).toEqual({
            MPD: {
                mediaPresentationDuration: 243.76,
                minBufferTime: 2,
                profiles: ['urn:mpeg:dash:profile:isoff-main:2011'],
                type: 'static',
                Period: [
                    {
                        id: '1',
                        start: 0,
                        duration: 243.76,
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        AdaptationSet: [
                            {
                                actuate: 'onRequest',
                                bitstreamSwitching: false,
                                frameRate: [25, 1],
                                mimeType: 'video/mp4',
                                segmentAlignment: true,
                                selectionPriority: 1,
                                startWithSAP: 1,
                                subsegmentAlignment: true,
                                subsegmentStartsWithSAP: 1,
                                SegmentTemplate: {
                                    duration: 180000,
                                    indexRangeExact: false,
                                    startNumber: 1,
                                    timescale: 90000,
                                },
                                Representation: [
                                    {
                                        id: '1',
                                        width: 1920,
                                        height: 1080,
                                        bandwidth: 5000000,
                                        codecs: 'avc1.640028',
                                        SegmentTemplate: {
                                            media: 'DashTest3_1080p_$Number%09d$.mp4',
                                            initialization:
                                                'DashTest3_1080pinit.mp4',
                                            duration: 180000,
                                            indexRangeExact: false,
                                            startNumber: 1,
                                        },
                                    },
                                    {
                                        id: '2',
                                        width: 1280,
                                        height: 720,
                                        bandwidth: 2500000,
                                        codecs: 'avc1.64001f',
                                        SegmentTemplate: {
                                            media: 'DashTest3_720p_$Number%09d$.mp4',
                                            initialization:
                                                'DashTest3_720pinit.mp4',
                                            duration: 180000,
                                            indexRangeExact: false,
                                            startNumber: 1,
                                        },
                                    },
                                    {
                                        id: '3',
                                        width: 854,
                                        height: 480,
                                        bandwidth: 1200000,
                                        codecs: 'avc1.64001e',
                                        SegmentTemplate: {
                                            media: 'DashTest3_480p_$Number%09d$.mp4',
                                            initialization:
                                                'DashTest3_480pinit.mp4',
                                            duration: 180000,
                                            indexRangeExact: false,
                                            startNumber: 1,
                                        },
                                    },
                                    {
                                        id: '4',
                                        width: 640,
                                        height: 360,
                                        bandwidth: 600000,
                                        codecs: 'avc1.64001e',
                                        SegmentTemplate: {
                                            media: 'DashTest3_360p_$Number%09d$.mp4',
                                            initialization:
                                                'DashTest3_360pinit.mp4',
                                            duration: 180000,
                                            indexRangeExact: false,
                                            startNumber: 1,
                                        },
                                    },
                                ],
                            },
                            {
                                actuate: 'onRequest',
                                lang: 'und',
                                mimeType: 'audio/mp4',
                                segmentAlignment: false,
                                selectionPriority: 1,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                SegmentTemplate: {
                                    timescale: 48000,
                                    media: 'DashTest3_audio_$Number%09d$.mp4',
                                    initialization: 'DashTest3_audioinit.mp4',
                                    duration: 96000,
                                    indexRangeExact: false,
                                    startNumber: 1,
                                },
                                Representation: [
                                    {
                                        id: '5',
                                        bandwidth: 128000,
                                        audioSamplingRate: [48000],
                                        codecs: 'mp4a.40.2',
                                        AudioChannelConfiguration: [
                                            {
                                                schemeIdUri:
                                                    'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                                value: '2',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        })
    })
})
