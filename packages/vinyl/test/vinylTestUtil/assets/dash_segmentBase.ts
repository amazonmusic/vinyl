/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// noinspection XmlPathReference

/**
 * A Dash manifest that uses SegmentBase with index ranges.
 */
// language=XML
export const dash_segmentBase = `<?xml version="1.0" encoding="UTF-8"?>
<!--Generated with https://github.com/google/shaka-packager version v2.6.1-634af65-release-->
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT2S" type="static" mediaPresentationDuration="PT60S">
    <Period id="0">
        <AdaptationSet id="0" contentType="audio" subsegmentAlignment="true">
            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="1,2"/>
            <Representation id="0" bandwidth="51160" codecs="mp4a.40.2" mimeType="audio/mp4" audioSamplingRate="44100">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/aac_60s_2ch_16bit_44100Hz_48kbps.mp4</BaseURL>
                <SegmentBase indexRange="826-929" timescale="44100">
                    <Initialization range="0-825"/>
                </SegmentBase>
            </Representation>
            <Representation id="14" bandwidth="124766" codecs="mp4a.40.2" mimeType="audio/mp4" audioSamplingRate="44100">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/aac_60s_2ch_16bit_44100Hz_256kbps.mp4</BaseURL>
                <SegmentBase indexRange="826-929" timescale="44100">
                    <Initialization range="0-825"/>
                </SegmentBase>
            </Representation>
            <Representation id="15" bandwidth="114639" codecs="mp4a.40.2" mimeType="audio/mp4" audioSamplingRate="44100">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/aac_60s_2ch_16bit_44100Hz_128kbps.mp4</BaseURL>
                <SegmentBase indexRange="826-929" timescale="44100">
                    <Initialization range="0-825"/>
                </SegmentBase>
            </Representation>
        </AdaptationSet>
        <AdaptationSet id="1" contentType="audio">
            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="0,2"/>
            <Representation id="1" bandwidth="141719" codecs="flac" mimeType="audio/mp4" audioSamplingRate="44100">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_16bit_44100Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="44100">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="3" bandwidth="541361" codecs="flac" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_24bit_48000Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="48000">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="4" bandwidth="470315" codecs="flac" mimeType="audio/mp4" audioSamplingRate="0">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_16bit_192000Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="192000">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="6" bandwidth="2192360" codecs="flac" mimeType="audio/mp4" audioSamplingRate="0">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_24bit_192000Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="192000">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="8" bandwidth="153326" codecs="flac" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_16bit_48000Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="48000">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="10" bandwidth="257514" codecs="flac" mimeType="audio/mp4" audioSamplingRate="0">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_16bit_96000Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="96000">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="11" bandwidth="495381" codecs="flac" mimeType="audio/mp4" audioSamplingRate="44100">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_24bit_44100Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="44100">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
            <Representation id="16" bandwidth="1074424" codecs="flac" mimeType="audio/mp4" audioSamplingRate="0">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/flac_60s_2ch_24bit_96000Hz.mp4</BaseURL>
                <SegmentBase indexRange="772-875" timescale="96000">
                    <Initialization range="0-771"/>
                </SegmentBase>
            </Representation>
        </AdaptationSet>
        <AdaptationSet id="2" contentType="audio" subsegmentAlignment="true">
            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="0,1"/>
            <Representation id="2" bandwidth="322671" codecs="opus" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/opus_60s_2ch_16bit_44100Hz_320kbps.mp4</BaseURL>
                <SegmentBase indexRange="803-906" timescale="48000">
                    <Initialization range="0-802"/>
                </SegmentBase>
            </Representation>
            <Representation id="5" bandwidth="50194" codecs="opus" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/opus_60s_2ch_16bit_44100Hz_48kbps.mp4</BaseURL>
                <SegmentBase indexRange="803-906" timescale="48000">
                    <Initialization range="0-802"/>
                </SegmentBase>
            </Representation>
            <Representation id="7" bandwidth="50194" codecs="opus" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/opus_60s_2ch_16bit_192000Hz_48kbps.mp4</BaseURL>
                <SegmentBase indexRange="803-906" timescale="48000">
                    <Initialization range="0-802"/>
                </SegmentBase>
            </Representation>
            <Representation id="9" bandwidth="162390" codecs="opus" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/opus_60s_2ch_16bit_192000Hz_160kbps.mp4</BaseURL>
                <SegmentBase indexRange="803-906" timescale="48000">
                    <Initialization range="0-802"/>
                </SegmentBase>
            </Representation>
            <Representation id="12" bandwidth="322671" codecs="opus" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/opus_60s_2ch_16bit_192000Hz_320kbps.mp4</BaseURL>
                <SegmentBase indexRange="803-906" timescale="48000">
                    <Initialization range="0-802"/>
                </SegmentBase>
            </Representation>
            <Representation id="13" bandwidth="162390" codecs="opus" mimeType="audio/mp4" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>representations/opus_60s_2ch_16bit_44100Hz_160kbps.mp4</BaseURL>
                <SegmentBase indexRange="803-906" timescale="48000">
                    <Initialization range="0-802"/>
                </SegmentBase>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>
`
