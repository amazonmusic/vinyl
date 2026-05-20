/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Example pulled from https://docs.aws.amazon.com/mediatailor/latest/ug/single-period-dash-manifest-example.html
 * Note: does not currently support xmlns http://www.scte.org/schemas/35/2016
 */
// language=XML
export const dash_personalizedResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MPD minBufferTime="PT10.00S" profiles="urn:mpeg:dash:profile:isoff-live:2011" xmlns="urn:mpeg:dash:schema:mpd:2011">
    <Period id="0.0" start="PT0S">
        <BaseURL>dash/</BaseURL>
        <AdaptationSet audioSamplingRate="48000" codecs="mp4a.40.2" contentType="audio" group="1" id="1"
                       mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="1"/>
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="69000" id="audio=69000">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="0"
                                 startNumber="1" timescale="48000">
                    <SegmentTimeline>
                        <S d="48129" t="74412130844415"/>
                        <S d="48128" t="74412130892544"/>
                        <S d="48127" t="74412130940672"/>
                        <S d="48129" t="74412130988799"/>
                        <S d="48128" t="74412131036928"/>
                        <S d="47104" t="74412131085056"/>
                        <S d="48128" t="74412131132160"/>
                        <S d="48127" t="74412131180288"/>
                        <S d="48129" t="74412131228415"/>
                        <S d="48128" t="74412131276544"/>
                        <S d="48127" t="74412131324672"/>
                        <S d="48129" t="74412131372799"/>
                        <S d="48128" t="74412131420928"/>
                        <S d="47104" t="74412131469056"/>
                        <S d="48128" t="74412131516160"/>
                        <S d="48127" t="74412131564288"/>
                        <S d="48129" t="74412131612415"/>
                        <S d="48128" t="74412131660544"/>
                        <S d="48127" t="74412131708672"/>
                        <S d="48129" t="74412131756799"/>
                        <S d="48128" t="74412131804928"/>
                        <S d="47104" t="74412131853056"/>
                        <S d="48128" t="74412131900160"/>
                        <S d="48127" t="74412131948288"/>
                        <S d="48129" t="74412131996415"/>
                        <S d="48128" t="74412132044544"/>
                        <S d="48127" t="74412132092672"/>
                        <S d="48129" t="74412132140799"/>
                        <S d="48128" t="74412132188928"/>
                        <S d="47104" t="74412132237056"/>
                        <S d="48128" t="74412132284160"/>
                        <S d="48127" t="74412132332288"/>
                        <S d="48129" t="74412132380415"/>
                        <S d="48128" t="74412132428544"/>
                        <S d="48127" t="74412132476672"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet codecs="avc1.64001F" contentType="video" group="2" height="720" id="2" mimeType="video/mp4"
                       par="16:9" sar="1:1" segmentAlignment="true" startWithSAP="1" width="1280">
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="700000" id="video=700000" scanType="progressive">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="0"
                                 startNumber="1" timescale="90000">
                    <SegmentTimeline>
                        <S d="90000" r="34" t="139522745250000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550252760.0_1" start="PT430625H46M">
        <BaseURL>http://d2gh0tfpz97e4o.cloudfront.net/visitalps/</BaseURL>
        <AdaptationSet bitstreamSwitching="false" frameRate="30/1" mimeType="video/mp4" segmentAlignment="true"
                       startWithSAP="1" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
            <SegmentTemplate startNumber="1" timescale="90000"/>
            <Representation bandwidth="7500000" codecs="avc1.640028" height="1080" id="1" width="1920">
                <SegmentTemplate initialization="visitalps_1080p30_video_1080p_10init.mp4"
                                 media="visitalps_1080p30_video_1080p_10_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="3000000" codecs="avc1.64001f" height="720" id="2" width="1280">
                <SegmentTemplate initialization="visitalps_1080p30_video_720p_9init.mp4"
                                 media="visitalps_1080p30_video_720p_9_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1875000" codecs="avc1.64001f" height="720" id="3" width="1280">
                <SegmentTemplate initialization="visitalps_1080p30_video_720p_8init.mp4"
                                 media="visitalps_1080p30_video_720p_8_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="270000" r="3" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1500000" codecs="avc1.64001f" height="540" id="4" width="960">
                <SegmentTemplate initialization="visitalps_1080p30_video_540p_7init.mp4"
                                 media="visitalps_1080p30_video_540p_7_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1012500" codecs="avc1.64001e" height="396" id="5" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_6init.mp4"
                                 media="visitalps_1080p30_video_396p_6_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="675000" codecs="avc1.64001e" height="396" id="6" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_5init.mp4"
                                 media="visitalps_1080p30_video_396p_5_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="450000" codecs="avc1.64001e" height="396" id="7" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_4init.mp4"
                                 media="visitalps_1080p30_video_396p_4_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="337500" codecs="avc1.640016" height="288" id="8" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_3init.mp4"
                                 media="visitalps_1080p30_video_288p_3_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="225000" codecs="avc1.640016" height="288" id="9" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_2init.mp4"
                                 media="visitalps_1080p30_video_288p_2_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="150000" codecs="avc1.640016" height="288" id="10" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_1init.mp4"
                                 media="visitalps_1080p30_video_288p_1_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet lang="eng" mimeType="audio/mp4" segmentAlignment="0">
            <SegmentTemplate initialization="visitalps_1080p30_audio_aac_128kinit.mp4"
                             media="visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4" startNumber="1"
                             timescale="48000"/>
            <Representation audioSamplingRate="48000" bandwidth="128000" codecs="mp4a.40.2" id="11">
                <SegmentTemplate initialization="visitalps_1080p30_audio_aac_128kinit.mp4"
                                 media="visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4" startNumber="1"
                                 timescale="48000">
                    <SegmentTimeline>
                        <S d="96000" r="6" t="0"/>
                        <S d="46368" t="672000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550252760.0" start="PT430625H46M14.966S">
        <BaseURL>dash/</BaseURL>
        <EventStream schemeIdUri="urn:scte:scte35:2014:xml+bin" timescale="1">
            <Event duration="24" id="136" presentationTime="1550252760">
                <Signal xmlns="http://www.scte.org/schemas/35/2016">
                    <Binary>/DAhAAAAAAAAAP/wEAUAAACIf+9/fgAg9YDAAAAAAABiJjIs</Binary>
                </Signal>
            </Event>
        </EventStream>
        <AdaptationSet audioSamplingRate="48000" codecs="mp4a.40.2" contentType="audio" group="1" id="1"
                       mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="1"/>
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="69000" id="audio=69000">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="74412133198368"
                                 timescale="48000">
                    <SegmentTimeline>
                        <S d="48128" t="74412133196544"/>
                        <S d="48127" t="74412133244672"/>
                        <S d="48129" t="74412133292799"/>
                        <S d="48128" t="74412133340928"/>
                        <S d="47104" t="74412133389056"/>
                        <S d="48128" t="74412133436160"/>
                        <S d="48127" t="74412133484288"/>
                        <S d="48129" t="74412133532415"/>
                        <S d="48128" t="74412133580544"/>
                        <S d="48127" t="74412133628672"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet codecs="avc1.64001F" contentType="video" group="2" height="720" id="2" mimeType="video/mp4"
                       par="16:9" sar="1:1" segmentAlignment="true" startWithSAP="1" width="1280">
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="700000" id="video=700000" scanType="progressive">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="139522749746940"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="90000" r="9" t="139522749660000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550252784.0" start="PT430625H46M24S">
        <BaseURL>dash/</BaseURL>
        <AdaptationSet audioSamplingRate="48000" codecs="mp4a.40.2" contentType="audio" group="1" id="1"
                       mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="1"/>
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="69000" id="audio=69000">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="74412133632000"
                                 startNumber="60" timescale="48000">
                    <SegmentTimeline>
                        <S d="48129" t="74412133676799"/>
                        <S d="48128" t="74412133724928"/>
                        <S d="47104" t="74412133773056"/>
                        <S d="48128" t="74412133820160"/>
                        <S d="48127" t="74412133868288"/>
                        <S d="48129" t="74412133916415"/>
                        <S d="48128" t="74412133964544"/>
                        <S d="48127" t="74412134012672"/>
                        <S d="48129" t="74412134060799"/>
                        <S d="48128" t="74412134108928"/>
                        <S d="47104" t="74412134157056"/>
                        <S d="48128" t="74412134204160"/>
                        <S d="48127" t="74412134252288"/>
                        <S d="48129" t="74412134300415"/>
                        <S d="48128" t="74412134348544"/>
                        <S d="48127" t="74412134396672"/>
                        <S d="48129" t="74412134444799"/>
                        <S d="48128" t="74412134492928"/>
                        <S d="47104" t="74412134541056"/>
                        <S d="48128" t="74412134588160"/>
                        <S d="48127" t="74412134636288"/>
                        <S d="48129" t="74412134684415"/>
                        <S d="48128" t="74412134732544"/>
                        <S d="48127" t="74412134780672"/>
                        <S d="48129" t="74412134828799"/>
                        <S d="48128" t="74412134876928"/>
                        <S d="47104" t="74412134925056"/>
                        <S d="48128" t="74412134972160"/>
                        <S d="48127" t="74412135020288"/>
                        <S d="48129" t="74412135068415"/>
                        <S d="48128" t="74412135116544"/>
                        <S d="48127" t="74412135164672"/>
                        <S d="48129" t="74412135212799"/>
                        <S d="48128" t="74412135260928"/>
                        <S d="47104" t="74412135309056"/>
                        <S d="48128" t="74412135356160"/>
                        <S d="48127" t="74412135404288"/>
                        <S d="48129" t="74412135452415"/>
                        <S d="48128" t="74412135500544"/>
                        <S d="48127" t="74412135548672"/>
                        <S d="48129" t="74412135596799"/>
                        <S d="48128" t="74412135644928"/>
                        <S d="47104" t="74412135693056"/>
                        <S d="48128" t="74412135740160"/>
                        <S d="48127" t="74412135788288"/>
                        <S d="48129" t="74412135836415"/>
                        <S d="48128" t="74412135884544"/>
                        <S d="48127" t="74412135932672"/>
                        <S d="48129" t="74412135980799"/>
                        <S d="48128" t="74412136028928"/>
                        <S d="47104" t="74412136077056"/>
                        <S d="48128" t="74412136124160"/>
                        <S d="48127" t="74412136172288"/>
                        <S d="48129" t="74412136220415"/>
                        <S d="48128" t="74412136268544"/>
                        <S d="48127" t="74412136316672"/>
                        <S d="48129" t="74412136364799"/>
                        <S d="48128" t="74412136412928"/>
                        <S d="47104" t="74412136461056"/>
                        <S d="48128" t="74412136508160"/>
                        <S d="48127" t="74412136556288"/>
                        <S d="48129" t="74412136604415"/>
                        <S d="48128" t="74412136652544"/>
                        <S d="48127" t="74412136700672"/>
                        <S d="48129" t="74412136748799"/>
                        <S d="48128" t="74412136796928"/>
                        <S d="47104" t="74412136845056"/>
                        <S d="48128" t="74412136892160"/>
                        <S d="48127" t="74412136940288"/>
                        <S d="48129" t="74412136988415"/>
                        <S d="48128" t="74412137036544"/>
                        <S d="48127" t="74412137084672"/>
                        <S d="48129" t="74412137132799"/>
                        <S d="48128" t="74412137180928"/>
                        <S d="47104" t="74412137229056"/>
                        <S d="48128" t="74412137276160"/>
                        <S d="48127" t="74412137324288"/>
                        <S d="48129" t="74412137372415"/>
                        <S d="48128" t="74412137420544"/>
                        <S d="48127" t="74412137468672"/>
                        <S d="48129" t="74412137516799"/>
                        <S d="48128" t="74412137564928"/>
                        <S d="47104" t="74412137613056"/>
                        <S d="48128" t="74412137660160"/>
                        <S d="48127" t="74412137708288"/>
                        <S d="48129" t="74412137756415"/>
                        <S d="48128" t="74412137804544"/>
                        <S d="48127" t="74412137852672"/>
                        <S d="48129" t="74412137900799"/>
                        <S d="48128" t="74412137948928"/>
                        <S d="47104" t="74412137997056"/>
                        <S d="48128" t="74412138044160"/>
                        <S d="48127" t="74412138092288"/>
                        <S d="48129" t="74412138140415"/>
                        <S d="48128" t="74412138188544"/>
                        <S d="48127" t="74412138236672"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet codecs="avc1.64001F" contentType="video" group="2" height="720" id="2" mimeType="video/mp4"
                       par="16:9" sar="1:1" segmentAlignment="true" startWithSAP="1" width="1280">
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="700000" id="video=700000" scanType="progressive">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="139522750560000"
                                 startNumber="60" timescale="90000">
                    <SegmentTimeline>
                        <S d="90000" r="95" t="139522750560000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550252880.0_1" start="PT430625H48M">
        <BaseURL>http://d2gh0tfpz97e4o.cloudfront.net/visitalps/</BaseURL>
        <AdaptationSet bitstreamSwitching="false" frameRate="30/1" mimeType="video/mp4" segmentAlignment="true"
                       startWithSAP="1" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
            <SegmentTemplate startNumber="1" timescale="90000"/>
            <Representation bandwidth="7500000" codecs="avc1.640028" height="1080" id="1" width="1920">
                <SegmentTemplate initialization="visitalps_1080p30_video_1080p_10init.mp4"
                                 media="visitalps_1080p30_video_1080p_10_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="3000000" codecs="avc1.64001f" height="720" id="2" width="1280">
                <SegmentTemplate initialization="visitalps_1080p30_video_720p_9init.mp4"
                                 media="visitalps_1080p30_video_720p_9_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1875000" codecs="avc1.64001f" height="720" id="3" width="1280">
                <SegmentTemplate initialization="visitalps_1080p30_video_720p_8init.mp4"
                                 media="visitalps_1080p30_video_720p_8_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="270000" r="3" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1500000" codecs="avc1.64001f" height="540" id="4" width="960">
                <SegmentTemplate initialization="visitalps_1080p30_video_540p_7init.mp4"
                                 media="visitalps_1080p30_video_540p_7_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1012500" codecs="avc1.64001e" height="396" id="5" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_6init.mp4"
                                 media="visitalps_1080p30_video_396p_6_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="675000" codecs="avc1.64001e" height="396" id="6" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_5init.mp4"
                                 media="visitalps_1080p30_video_396p_5_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="450000" codecs="avc1.64001e" height="396" id="7" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_4init.mp4"
                                 media="visitalps_1080p30_video_396p_4_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="337500" codecs="avc1.640016" height="288" id="8" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_3init.mp4"
                                 media="visitalps_1080p30_video_288p_3_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="225000" codecs="avc1.640016" height="288" id="9" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_2init.mp4"
                                 media="visitalps_1080p30_video_288p_2_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="150000" codecs="avc1.640016" height="288" id="10" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_1init.mp4"
                                 media="visitalps_1080p30_video_288p_1_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet lang="eng" mimeType="audio/mp4" segmentAlignment="0">
            <SegmentTemplate initialization="visitalps_1080p30_audio_aac_128kinit.mp4"
                             media="visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4" startNumber="1"
                             timescale="48000"/>
            <Representation audioSamplingRate="48000" bandwidth="128000" codecs="mp4a.40.2" id="11">
                <SegmentTemplate initialization="visitalps_1080p30_audio_aac_128kinit.mp4"
                                 media="visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4" startNumber="1"
                                 timescale="48000">
                    <SegmentTimeline>
                        <S d="96000" r="6" t="0"/>
                        <S d="46368" t="672000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550252880.0" start="PT430625H48M14.966S">
        <BaseURL>dash/</BaseURL>
        <EventStream schemeIdUri="urn:scte:scte35:2014:xml+bin" timescale="1">
            <Event duration="24" id="137" presentationTime="1550252880">
                <Signal xmlns="http://www.scte.org/schemas/35/2016">
                    <Binary>/DAhAAAAAAAAAP/wEAUAAACJf+9/fgAg9YDAAAAAAAC/KdNe</Binary>
                </Signal>
            </Event>
        </EventStream>
        <AdaptationSet audioSamplingRate="48000" codecs="mp4a.40.2" contentType="audio" group="1" id="1"
                       mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="1"/>
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="69000" id="audio=69000">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="74412138958368"
                                 timescale="48000">
                    <SegmentTimeline>
                        <S d="48128" t="74412138956544"/>
                        <S d="48127" t="74412139004672"/>
                        <S d="48129" t="74412139052799"/>
                        <S d="48128" t="74412139100928"/>
                        <S d="47104" t="74412139149056"/>
                        <S d="48128" t="74412139196160"/>
                        <S d="48127" t="74412139244288"/>
                        <S d="48129" t="74412139292415"/>
                        <S d="48128" t="74412139340544"/>
                        <S d="48127" t="74412139388672"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet codecs="avc1.64001F" contentType="video" group="2" height="720" id="2" mimeType="video/mp4"
                       par="16:9" sar="1:1" segmentAlignment="true" startWithSAP="1" width="1280">
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="700000" id="video=700000" scanType="progressive">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="139522760546940"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="90000" r="9" t="139522760460000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550252904.0" start="PT430625H48M24S">
        <BaseURL>dash/</BaseURL>
        <AdaptationSet audioSamplingRate="48000" codecs="mp4a.40.2" contentType="audio" group="1" id="1"
                       mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="1"/>
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="69000" id="audio=69000">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="74412139392000"
                                 startNumber="180" timescale="48000">
                    <SegmentTimeline>
                        <S d="48129" t="74412139436799"/>
                        <S d="48128" t="74412139484928"/>
                        <S d="47104" t="74412139533056"/>
                        <S d="48128" t="74412139580160"/>
                        <S d="48127" t="74412139628288"/>
                        <S d="48129" t="74412139676415"/>
                        <S d="48128" t="74412139724544"/>
                        <S d="48127" t="74412139772672"/>
                        <S d="48129" t="74412139820799"/>
                        <S d="48128" t="74412139868928"/>
                        <S d="47104" t="74412139917056"/>
                        <S d="48128" t="74412139964160"/>
                        <S d="48127" t="74412140012288"/>
                        <S d="48129" t="74412140060415"/>
                        <S d="48128" t="74412140108544"/>
                        <S d="48127" t="74412140156672"/>
                        <S d="48129" t="74412140204799"/>
                        <S d="48128" t="74412140252928"/>
                        <S d="47104" t="74412140301056"/>
                        <S d="48128" t="74412140348160"/>
                        <S d="48127" t="74412140396288"/>
                        <S d="48129" t="74412140444415"/>
                        <S d="48128" t="74412140492544"/>
                        <S d="48127" t="74412140540672"/>
                        <S d="48129" t="74412140588799"/>
                        <S d="48128" t="74412140636928"/>
                        <S d="47104" t="74412140685056"/>
                        <S d="48128" t="74412140732160"/>
                        <S d="48127" t="74412140780288"/>
                        <S d="48129" t="74412140828415"/>
                        <S d="48128" t="74412140876544"/>
                        <S d="48127" t="74412140924672"/>
                        <S d="48129" t="74412140972799"/>
                        <S d="48128" t="74412141020928"/>
                        <S d="47104" t="74412141069056"/>
                        <S d="48128" t="74412141116160"/>
                        <S d="48127" t="74412141164288"/>
                        <S d="48129" t="74412141212415"/>
                        <S d="48128" t="74412141260544"/>
                        <S d="48127" t="74412141308672"/>
                        <S d="48129" t="74412141356799"/>
                        <S d="48128" t="74412141404928"/>
                        <S d="47104" t="74412141453056"/>
                        <S d="48128" t="74412141500160"/>
                        <S d="48127" t="74412141548288"/>
                        <S d="48129" t="74412141596415"/>
                        <S d="48128" t="74412141644544"/>
                        <S d="48127" t="74412141692672"/>
                        <S d="48129" t="74412141740799"/>
                        <S d="48128" t="74412141788928"/>
                        <S d="47104" t="74412141837056"/>
                        <S d="48128" t="74412141884160"/>
                        <S d="48127" t="74412141932288"/>
                        <S d="48129" t="74412141980415"/>
                        <S d="48128" t="74412142028544"/>
                        <S d="48127" t="74412142076672"/>
                        <S d="48129" t="74412142124799"/>
                        <S d="48128" t="74412142172928"/>
                        <S d="47104" t="74412142221056"/>
                        <S d="48128" t="74412142268160"/>
                        <S d="48127" t="74412142316288"/>
                        <S d="48129" t="74412142364415"/>
                        <S d="48128" t="74412142412544"/>
                        <S d="48127" t="74412142460672"/>
                        <S d="48129" t="74412142508799"/>
                        <S d="48128" t="74412142556928"/>
                        <S d="47104" t="74412142605056"/>
                        <S d="48128" t="74412142652160"/>
                        <S d="48127" t="74412142700288"/>
                        <S d="48129" t="74412142748415"/>
                        <S d="48128" t="74412142796544"/>
                        <S d="48127" t="74412142844672"/>
                        <S d="48129" t="74412142892799"/>
                        <S d="48128" t="74412142940928"/>
                        <S d="47104" t="74412142989056"/>
                        <S d="48128" t="74412143036160"/>
                        <S d="48127" t="74412143084288"/>
                        <S d="48129" t="74412143132415"/>
                        <S d="48128" t="74412143180544"/>
                        <S d="48127" t="74412143228672"/>
                        <S d="48129" t="74412143276799"/>
                        <S d="48128" t="74412143324928"/>
                        <S d="47104" t="74412143373056"/>
                        <S d="48128" t="74412143420160"/>
                        <S d="48127" t="74412143468288"/>
                        <S d="48129" t="74412143516415"/>
                        <S d="48128" t="74412143564544"/>
                        <S d="48127" t="74412143612672"/>
                        <S d="48129" t="74412143660799"/>
                        <S d="48128" t="74412143708928"/>
                        <S d="47104" t="74412143757056"/>
                        <S d="48128" t="74412143804160"/>
                        <S d="48127" t="74412143852288"/>
                        <S d="48129" t="74412143900415"/>
                        <S d="48128" t="74412143948544"/>
                        <S d="48127" t="74412143996672"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet codecs="avc1.64001F" contentType="video" group="2" height="720" id="2" mimeType="video/mp4"
                       par="16:9" sar="1:1" segmentAlignment="true" startWithSAP="1" width="1280">
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="700000" id="video=700000" scanType="progressive">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="139522761360000"
                                 startNumber="180" timescale="90000">
                    <SegmentTimeline>
                        <S d="90000" r="95" t="139522761360000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550253000.0_1" start="PT430625H50M">
        <BaseURL>http://d2gh0tfpz97e4o.cloudfront.net/visitalps/</BaseURL>
        <AdaptationSet bitstreamSwitching="false" frameRate="30/1" mimeType="video/mp4" segmentAlignment="true"
                       startWithSAP="1" subsegmentAlignment="true" subsegmentStartsWithSAP="1">
            <SegmentTemplate startNumber="1" timescale="90000"/>
            <Representation bandwidth="7500000" codecs="avc1.640028" height="1080" id="1" width="1920">
                <SegmentTemplate initialization="visitalps_1080p30_video_1080p_10init.mp4"
                                 media="visitalps_1080p30_video_1080p_10_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="3000000" codecs="avc1.64001f" height="720" id="2" width="1280">
                <SegmentTemplate initialization="visitalps_1080p30_video_720p_9init.mp4"
                                 media="visitalps_1080p30_video_720p_9_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1875000" codecs="avc1.64001f" height="720" id="3" width="1280">
                <SegmentTemplate initialization="visitalps_1080p30_video_720p_8init.mp4"
                                 media="visitalps_1080p30_video_720p_8_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="270000" r="3" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1500000" codecs="avc1.64001f" height="540" id="4" width="960">
                <SegmentTemplate initialization="visitalps_1080p30_video_540p_7init.mp4"
                                 media="visitalps_1080p30_video_540p_7_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="1012500" codecs="avc1.64001e" height="396" id="5" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_6init.mp4"
                                 media="visitalps_1080p30_video_396p_6_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="675000" codecs="avc1.64001e" height="396" id="6" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_5init.mp4"
                                 media="visitalps_1080p30_video_396p_5_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="450000" codecs="avc1.64001e" height="396" id="7" width="704">
                <SegmentTemplate initialization="visitalps_1080p30_video_396p_4init.mp4"
                                 media="visitalps_1080p30_video_396p_4_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="337500" codecs="avc1.640016" height="288" id="8" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_3init.mp4"
                                 media="visitalps_1080p30_video_288p_3_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="225000" codecs="avc1.640016" height="288" id="9" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_2init.mp4"
                                 media="visitalps_1080p30_video_288p_2_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="360000" r="2" t="0"/>
                        <S d="266940" t="1080000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
            <Representation bandwidth="150000" codecs="avc1.640016" height="288" id="10" width="512">
                <SegmentTemplate initialization="visitalps_1080p30_video_288p_1init.mp4"
                                 media="visitalps_1080p30_video_288p_1_$Number%09d$.mp4" startNumber="1"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="180000" r="6" t="0"/>
                        <S d="86940" t="1260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet lang="eng" mimeType="audio/mp4" segmentAlignment="0">
            <SegmentTemplate initialization="visitalps_1080p30_audio_aac_128kinit.mp4"
                             media="visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4" startNumber="1"
                             timescale="48000"/>
            <Representation audioSamplingRate="48000" bandwidth="128000" codecs="mp4a.40.2" id="11">
                <SegmentTemplate initialization="visitalps_1080p30_audio_aac_128kinit.mp4"
                                 media="visitalps_1080p30_audio_aac_128k_$Number%09d$.mp4" startNumber="1"
                                 timescale="48000">
                    <SegmentTimeline>
                        <S d="96000" r="6" t="0"/>
                        <S d="46368" t="672000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
    <Period id="1550253000.0" start="PT430625H50M14.966S">
        <BaseURL>dash/</BaseURL>
        <EventStream schemeIdUri="urn:scte:scte35:2014:xml+bin" timescale="1">
            <Event duration="24" id="138" presentationTime="1550253000">
                <Signal xmlns="http://www.scte.org/schemas/35/2016">
                    <Binary>/DAhAAAAAAAAAP/wEAUAAACKf+9/fgAg9YDAAAAAAADc+O1/</Binary>
                </Signal>
            </Event>
        </EventStream>
        <AdaptationSet audioSamplingRate="48000" codecs="mp4a.40.2" contentType="audio" group="1" id="1"
                       mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="1"/>
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="69000" id="audio=69000">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="74412144718368"
                                 timescale="48000">
                    <SegmentTimeline>
                        <S d="48128" t="74412144716544"/>
                        <S d="48127" t="74412144764672"/>
                        <S d="48129" t="74412144812799"/>
                        <S d="48128" t="74412144860928"/>
                        <S d="47104" t="74412144909056"/>
                        <S d="48128" t="74412144956160"/>
                        <S d="48127" t="74412145004288"/>
                        <S d="48129" t="74412145052415"/>
                        <S d="48128" t="74412145100544"/>
                        <S d="48127" t="74412145148672"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
        <AdaptationSet codecs="avc1.64001F" contentType="video" group="2" height="720" id="2" mimeType="video/mp4"
                       par="16:9" sar="1:1" segmentAlignment="true" startWithSAP="1" width="1280">
            <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
            <Representation bandwidth="700000" id="video=700000" scanType="progressive">
                <SegmentTemplate initialization="scte35-$RepresentationID$.dash"
                                 media="scte35-$RepresentationID$-$Time$.dash" presentationTimeOffset="139522771346940"
                                 timescale="90000">
                    <SegmentTimeline>
                        <S d="90000" r="9" t="139522771260000"/>
                    </SegmentTimeline>
                </SegmentTemplate>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>
`
