/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { stringifyDashManifest } from '@amazon/vinyl-mpd-parser'

describe('stringifyDashManifest', () => {
    it('is capable of converting a dash manifest into a string', () => {
        const string = stringifyDashManifest({
            MPD: {
                mediaPresentationDuration: 60 * 5 + 25.54,
                minBufferTime: 10,
                profiles: ['urn:mpeg:dash:profile:isoff-live:2011'],
                type: 'static',
                Period: [
                    {
                        actuate: 'onRequest',
                        bitstreamSwitching: false,
                        AdaptationSet: [
                            {
                                selectionPriority: 1,
                                mimeType: 'audio/mp4',
                                startWithSAP: 1,
                                ContentProtection: [
                                    {
                                        schemeIdUri:
                                            'urn:mpeg:dash:mp4protection:2011',
                                        value: 'cenc',
                                    },
                                    {
                                        schemeIdUri:
                                            'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95',
                                    },
                                    {
                                        schemeIdUri:
                                            'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
                                    },
                                ],
                                actuate: 'onRequest',
                                segmentAlignment: true,
                                subsegmentAlignment: false,
                                subsegmentStartsWithSAP: 0,
                                Representation: [
                                    {
                                        audioSamplingRate: [44100],
                                        codecs: 'mp4a.40.2',
                                        AudioChannelConfiguration: [
                                            {
                                                schemeIdUri:
                                                    'urn:mpeg:dash:23003:3:audio_channel_configuration:2011',
                                                value: '2',
                                            },
                                        ],
                                        bandwidth: 257597,
                                        id: 'audio/und/mp4a',
                                        SegmentList: {
                                            indexRangeExact: false,
                                            timescale: 1000,
                                            Initialization: {
                                                sourceURL:
                                                    'https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/init.mp4',
                                            },
                                            duration: 10000,
                                            actuate: 'onRequest',
                                            SegmentURL: [
                                                {
                                                    media: 'https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-1.m4s',
                                                },
                                                {
                                                    media: 'https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-2.m4s',
                                                },
                                                {
                                                    media: 'https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-3.m4s',
                                                },
                                                {
                                                    media: 'https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-4.m4s',
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        })
        // language=xml
        expect(string).toBe(`<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" mediaPresentationDuration="PT5M25.54S" minBufferTime="PT10S" profiles="urn:mpeg:dash:profile:isoff-live:2011">
    <Period>
        <AdaptationSet mimeType="audio/mp4" startWithSAP="1" segmentAlignment="true">
            <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc"/>
            <ContentProtection schemeIdUri="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95"/>
            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/>
            <Representation audioSamplingRate="44100" codecs="mp4a.40.2" bandwidth="257597" id="audio/und/mp4a">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SegmentList timescale="1000" duration="10000">
                    <Initialization sourceURL="https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/init.mp4"/>
                    <SegmentURL media="https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-1.m4s"/>
                    <SegmentURL media="https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-2.m4s"/>
                    <SegmentURL media="https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-3.m4s"/>
                    <SegmentURL media="https://djydd44qsc0ae.cloudfront.net/clearLead/audio/und/mp4a/seg-4.m4s"/>
                </SegmentList>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>`)
    })
})
