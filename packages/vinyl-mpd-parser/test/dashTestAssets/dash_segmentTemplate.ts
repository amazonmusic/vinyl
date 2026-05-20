/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A manifest with segment templates.
 */
// language=XML
export const dash_segmentTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:cenc="urn:mpeg:cenc:2013" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 http://standards.iso.org/ittf/PubliclyAvailableStandards/MPEG-DASH_schema_files/DASH-MPD.xsd" type="static" minBufferTime="PT2S" profiles="urn:mpeg:dash:profile:isoff-main:2011" mediaPresentationDuration="PT4M3.760S">
    <Period start="PT0S" duration="PT4M3.760S" id="1">
        <AdaptationSet mimeType="video/mp4" frameRate="25/1" segmentAlignment="true" subsegmentAlignment="true" startWithSAP="1" subsegmentStartsWithSAP="1" bitstreamSwitching="false">
            <SegmentTemplate timescale="90000" duration="180000" startNumber="1"/>
            <Representation id="1" width="1920" height="1080" bandwidth="5000000" codecs="avc1.640028">
                <SegmentTemplate media="DashTest3_1080p_$Number%09d$.mp4" initialization="DashTest3_1080pinit.mp4" duration="180000" startNumber="1"/>
            </Representation>
            <Representation id="2" width="1280" height="720" bandwidth="2500000" codecs="avc1.64001f">
                <SegmentTemplate media="DashTest3_720p_$Number%09d$.mp4" initialization="DashTest3_720pinit.mp4" duration="180000" startNumber="1"/>
            </Representation>
            <Representation id="3" width="854" height="480" bandwidth="1200000" codecs="avc1.64001e">
                <SegmentTemplate media="DashTest3_480p_$Number%09d$.mp4" initialization="DashTest3_480pinit.mp4" duration="180000" startNumber="1"/>
            </Representation>
            <Representation id="4" width="640" height="360" bandwidth="600000" codecs="avc1.64001e">
                <SegmentTemplate media="DashTest3_360p_$Number%09d$.mp4" initialization="DashTest3_360pinit.mp4" duration="180000" startNumber="1"/>
            </Representation>
        </AdaptationSet>
        <AdaptationSet mimeType="audio/mp4" lang="und" segmentAlignment="false">
            <SegmentTemplate timescale="48000" media="DashTest3_audio_$Number%09d$.mp4" initialization="DashTest3_audioinit.mp4" duration="96000" startNumber="1"/>
            <Representation id="5" bandwidth="128000" audioSamplingRate="48000" codecs="mp4a.40.2">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>`
