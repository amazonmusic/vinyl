/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An Amazon flac/opus catalog track example.
 * A SegmentList with SegmentURL elements using media ranges.
 *
 * (Mothership connection, parliament)
 */
// language=XML
export const dash_segmentListMediaRange = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MPD minBufferTime="PT2S" type="static" mediaPresentationDuration="PT400.0133056640625S" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:amz-music="urn:amazon:music:drm:2019" xmlns:cenc="urn:mpeg:cenc:2013" xmlns:mspr="urn:microsoft:playready">
    <Period id="0">
        <AdaptationSet id="1" contentType="audio" selectionPriority="2000">
            <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" cenc:default_KID="53443d2c-a548-037d-dfca-b6873a3b16a7" value="cenc"/>
            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
                <cenc:pssh>AAAAXXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAD0SEFNEPSylSAN938q2hzo7FqcaC0FtYXpvbk11c2ljIhxjaWQ6VTBROUxLVklBMzNmeXJhSE9qc1dwdz09</cenc:pssh>
            </ContentProtection>
            <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:ProgramLoudness" value="-13.5 LUFS"/>
            <SupplementalProperty schemeIdUri="amz-music:trackType" value="HD"/>
            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="2"/>
            <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:AnchorLoudness" value="-11.7 LUFS"/>
            <Representation id="1" qualityRanking="4" codecs="flac" audioSamplingRate="44100" bandwidth="1021104" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SupplementalProperty schemeIdUri="amz-music:bitDepth" value="16"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/a3ce7553-e9a3-3ca6-8fda-8f354b8cee0f.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=HD_44&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="44100" duration="441000">
                    <Initialization range="0-1067"/>
                    <SegmentURL mediaRange="1580-1124387"/>
                    <SegmentURL mediaRange="1124388-2301681"/>
                    <SegmentURL mediaRange="2301682-3413884"/>
                    <SegmentURL mediaRange="3413885-4563668"/>
                    <SegmentURL mediaRange="4563669-5789595"/>
                    <SegmentURL mediaRange="5789596-7027203"/>
                    <SegmentURL mediaRange="7027204-8258589"/>
                    <SegmentURL mediaRange="8258590-9476689"/>
                    <SegmentURL mediaRange="9476690-10663879"/>
                    <SegmentURL mediaRange="10663880-11801656"/>
                    <SegmentURL mediaRange="11801657-13028295"/>
                    <SegmentURL mediaRange="13028296-14259035"/>
                    <SegmentURL mediaRange="14259036-15501034"/>
                    <SegmentURL mediaRange="15501035-16715074"/>
                    <SegmentURL mediaRange="16715075-17945696"/>
                    <SegmentURL mediaRange="17945697-19181760"/>
                    <SegmentURL mediaRange="19181761-20430664"/>
                    <SegmentURL mediaRange="20430665-21668186"/>
                    <SegmentURL mediaRange="21668187-22889588"/>
                    <SegmentURL mediaRange="22889589-24105876"/>
                    <SegmentURL mediaRange="24105877-25286931"/>
                    <SegmentURL mediaRange="25286932-26474293"/>
                    <SegmentURL mediaRange="26474294-27717336"/>
                    <SegmentURL mediaRange="27717337-28944000"/>
                    <SegmentURL mediaRange="28944001-30217943"/>
                    <SegmentURL mediaRange="30217944-31494322"/>
                    <SegmentURL mediaRange="31494323-32753722"/>
                    <SegmentURL mediaRange="32753723-33819438"/>
                    <SegmentURL mediaRange="33819439-34871800"/>
                    <SegmentURL mediaRange="34871801-35987451"/>
                    <SegmentURL mediaRange="35987452-37198633"/>
                    <SegmentURL mediaRange="37198634-38400513"/>
                    <SegmentURL mediaRange="38400514-39590378"/>
                    <SegmentURL mediaRange="39590379-40775418"/>
                    <SegmentURL mediaRange="40775419-42023162"/>
                    <SegmentURL mediaRange="42023163-43262782"/>
                    <SegmentURL mediaRange="43262783-44466388"/>
                    <SegmentURL mediaRange="44466389-45664349"/>
                    <SegmentURL mediaRange="45664350-46838625"/>
                    <SegmentURL mediaRange="46838626-47421889"/>
                </SegmentList>
            </Representation>
            <Representation id="2" qualityRanking="3" codecs="flac" audioSamplingRate="48000" bandwidth="1855801" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SupplementalProperty schemeIdUri="amz-music:bitDepth" value="24"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/f5b706c9-5892-3a17-9d01-4da362cfad35.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=UHD_48&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="48000" duration="480000">
                    <Initialization range="0-1067"/>
                    <SegmentURL mediaRange="1580-2140301"/>
                    <SegmentURL mediaRange="2140302-4352961"/>
                    <SegmentURL mediaRange="4352962-6499834"/>
                    <SegmentURL mediaRange="6499835-8687556"/>
                    <SegmentURL mediaRange="8687557-10955471"/>
                    <SegmentURL mediaRange="10955472-13235819"/>
                    <SegmentURL mediaRange="13235820-15509496"/>
                    <SegmentURL mediaRange="15509497-17768731"/>
                    <SegmentURL mediaRange="17768732-19993372"/>
                    <SegmentURL mediaRange="19993373-22167125"/>
                    <SegmentURL mediaRange="22167126-24434254"/>
                    <SegmentURL mediaRange="24434255-26706557"/>
                    <SegmentURL mediaRange="26706558-28990196"/>
                    <SegmentURL mediaRange="28990197-31245239"/>
                    <SegmentURL mediaRange="31245240-33516976"/>
                    <SegmentURL mediaRange="33516977-35793411"/>
                    <SegmentURL mediaRange="35793412-38083225"/>
                    <SegmentURL mediaRange="38083226-40361780"/>
                    <SegmentURL mediaRange="40361781-42623154"/>
                    <SegmentURL mediaRange="42623155-44879987"/>
                    <SegmentURL mediaRange="44879988-47098315"/>
                    <SegmentURL mediaRange="47098316-49322904"/>
                    <SegmentURL mediaRange="49322905-51607367"/>
                    <SegmentURL mediaRange="51607368-53874862"/>
                    <SegmentURL mediaRange="53874863-56192866"/>
                    <SegmentURL mediaRange="56192867-58512617"/>
                    <SegmentURL mediaRange="58512618-60815181"/>
                    <SegmentURL mediaRange="60815182-62914181"/>
                    <SegmentURL mediaRange="62914182-65000611"/>
                    <SegmentURL mediaRange="65000612-67150839"/>
                    <SegmentURL mediaRange="67150840-69402495"/>
                    <SegmentURL mediaRange="69402496-71643660"/>
                    <SegmentURL mediaRange="71643661-73870974"/>
                    <SegmentURL mediaRange="73870975-76093618"/>
                    <SegmentURL mediaRange="76093619-78383457"/>
                    <SegmentURL mediaRange="78383458-80665083"/>
                    <SegmentURL mediaRange="80665084-82909593"/>
                    <SegmentURL mediaRange="82909594-85145972"/>
                    <SegmentURL mediaRange="85145973-87356513"/>
                    <SegmentURL mediaRange="87356514-88804457"/>
                </SegmentList>
            </Representation>
            <Representation id="3" qualityRanking="2" codecs="flac" audioSamplingRate="96000" bandwidth="3278164" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SupplementalProperty schemeIdUri="amz-music:bitDepth" value="24"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/02b134c4-8144-3ab1-b125-5af2d0133d5b.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=UHD_96&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="96000" duration="960000">
                    <Initialization range="0-1067"/>
                    <SegmentURL mediaRange="1580-3813567"/>
                    <SegmentURL mediaRange="3813568-7746339"/>
                    <SegmentURL mediaRange="7746340-11599579"/>
                    <SegmentURL mediaRange="11599580-15505023"/>
                    <SegmentURL mediaRange="15505024-19519493"/>
                    <SegmentURL mediaRange="19519494-23556777"/>
                    <SegmentURL mediaRange="23556778-27581158"/>
                    <SegmentURL mediaRange="27581159-31586807"/>
                    <SegmentURL mediaRange="31586808-35549718"/>
                    <SegmentURL mediaRange="35549719-39435585"/>
                    <SegmentURL mediaRange="39435586-43443650"/>
                    <SegmentURL mediaRange="43443651-47467685"/>
                    <SegmentURL mediaRange="47467686-51498910"/>
                    <SegmentURL mediaRange="51498911-55496614"/>
                    <SegmentURL mediaRange="55496615-59513566"/>
                    <SegmentURL mediaRange="59513567-63538385"/>
                    <SegmentURL mediaRange="63538386-67582593"/>
                    <SegmentURL mediaRange="67582594-71608871"/>
                    <SegmentURL mediaRange="71608872-75612860"/>
                    <SegmentURL mediaRange="75612861-79601033"/>
                    <SegmentURL mediaRange="79601034-83549776"/>
                    <SegmentURL mediaRange="83549777-87488907"/>
                    <SegmentURL mediaRange="87488908-91534801"/>
                    <SegmentURL mediaRange="91534802-95552040"/>
                    <SegmentURL mediaRange="95552041-99649744"/>
                    <SegmentURL mediaRange="99649745-103743373"/>
                    <SegmentURL mediaRange="103743374-107815594"/>
                    <SegmentURL mediaRange="107815595-111613915"/>
                    <SegmentURL mediaRange="111613916-115390443"/>
                    <SegmentURL mediaRange="115390444-119249732"/>
                    <SegmentURL mediaRange="119249733-123233807"/>
                    <SegmentURL mediaRange="123233808-127209398"/>
                    <SegmentURL mediaRange="127209399-131167116"/>
                    <SegmentURL mediaRange="131167117-135119879"/>
                    <SegmentURL mediaRange="135119880-139163685"/>
                    <SegmentURL mediaRange="139163686-143201079"/>
                    <SegmentURL mediaRange="143201080-147195194"/>
                    <SegmentURL mediaRange="147195195-151164220"/>
                    <SegmentURL mediaRange="151164221-155096800"/>
                    <SegmentURL mediaRange="155096801-157757393"/>
                </SegmentList>
            </Representation>
            <Representation id="4" qualityRanking="1" codecs="flac" audioSamplingRate="192000" bandwidth="5666448" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SupplementalProperty schemeIdUri="amz-music:bitDepth" value="24"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/edf9f9cb-46ce-33bd-96e1-8456547fbef4.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=UHD_192&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="192000" duration="1920000">
                    <Initialization range="0-1067"/>
                    <SegmentURL mediaRange="1580-6720450"/>
                    <SegmentURL mediaRange="6720451-13610816"/>
                    <SegmentURL mediaRange="13610817-20415282"/>
                    <SegmentURL mediaRange="20415283-27272412"/>
                    <SegmentURL mediaRange="27272413-34250251"/>
                    <SegmentURL mediaRange="34250252-41260291"/>
                    <SegmentURL mediaRange="41260292-48255248"/>
                    <SegmentURL mediaRange="48255249-55224355"/>
                    <SegmentURL mediaRange="55224356-62157463"/>
                    <SegmentURL mediaRange="62157464-68996670"/>
                    <SegmentURL mediaRange="68996671-75970335"/>
                    <SegmentURL mediaRange="75970336-82964531"/>
                    <SegmentURL mediaRange="82964532-89965755"/>
                    <SegmentURL mediaRange="89965756-96928368"/>
                    <SegmentURL mediaRange="96928369-103911265"/>
                    <SegmentURL mediaRange="103911266-110903999"/>
                    <SegmentURL mediaRange="110904000-117921608"/>
                    <SegmentURL mediaRange="117921609-124920837"/>
                    <SegmentURL mediaRange="124920838-131897214"/>
                    <SegmentURL mediaRange="131897215-138848614"/>
                    <SegmentURL mediaRange="138848615-145764349"/>
                    <SegmentURL mediaRange="145764350-152655256"/>
                    <SegmentURL mediaRange="152655257-159680382"/>
                    <SegmentURL mediaRange="159680383-166667521"/>
                    <SegmentURL mediaRange="166667522-173750581"/>
                    <SegmentURL mediaRange="173750582-180827932"/>
                    <SegmentURL mediaRange="180827933-187877145"/>
                    <SegmentURL mediaRange="187877146-194626820"/>
                    <SegmentURL mediaRange="194626821-201345524"/>
                    <SegmentURL mediaRange="201345525-208145573"/>
                    <SegmentURL mediaRange="208145574-215088653"/>
                    <SegmentURL mediaRange="215088654-222022478"/>
                    <SegmentURL mediaRange="222022479-228934595"/>
                    <SegmentURL mediaRange="228934596-235844464"/>
                    <SegmentURL mediaRange="235844465-242852767"/>
                    <SegmentURL mediaRange="242852768-249863893"/>
                    <SegmentURL mediaRange="249863894-256824103"/>
                    <SegmentURL mediaRange="256824104-263749124"/>
                    <SegmentURL mediaRange="263749125-270634182"/>
                    <SegmentURL mediaRange="270634183-275673081"/>
                </SegmentList>
            </Representation>
        </AdaptationSet>
        <AdaptationSet id="2" contentType="audio" selectionPriority="1000">
            <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" cenc:default_KID="f65d52c1-4de5-e5b6-7296-2f48eddf7378" value="cenc"/>
            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
                <cenc:pssh>AAAAXXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAD0SEPZdUsFN5eW2cpYvSO3fc3gaC0FtYXpvbk11c2ljIhxjaWQ6OWwxU3dVM2w1Ylp5bGk5STdkOXplQT09</cenc:pssh>
            </ContentProtection>
            <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:ProgramLoudness" value="-13.5 LUFS"/>
            <SupplementalProperty schemeIdUri="amz-music:trackType" value="SD"/>
            <SupplementalProperty schemeIdUri="urn:mpeg:dash:adaptation-set-switching:2016" value="1"/>
            <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:AnchorLoudness" value="-11.7 LUFS"/>
            <Representation id="5" qualityRanking="3" codecs="opus" audioSamplingRate="48000" bandwidth="52950" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/7e2d628d-7666-3ad5-a9df-8ba4e1c6391c.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=SD_LOW&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="48000" duration="480000">
                    <Initialization range="0-1031"/>
                    <SegmentURL mediaRange="1544-61799"/>
                    <SegmentURL mediaRange="61800-121935"/>
                    <SegmentURL mediaRange="121936-182071"/>
                    <SegmentURL mediaRange="182072-246260"/>
                    <SegmentURL mediaRange="246261-310449"/>
                    <SegmentURL mediaRange="310450-374638"/>
                    <SegmentURL mediaRange="374639-438827"/>
                    <SegmentURL mediaRange="438828-503016"/>
                    <SegmentURL mediaRange="503017-567205"/>
                    <SegmentURL mediaRange="567206-631394"/>
                    <SegmentURL mediaRange="631395-695583"/>
                    <SegmentURL mediaRange="695584-759772"/>
                    <SegmentURL mediaRange="759773-823961"/>
                    <SegmentURL mediaRange="823962-888150"/>
                    <SegmentURL mediaRange="888151-952339"/>
                    <SegmentURL mediaRange="952340-1016528"/>
                    <SegmentURL mediaRange="1016529-1080717"/>
                    <SegmentURL mediaRange="1080718-1144906"/>
                    <SegmentURL mediaRange="1144907-1209095"/>
                    <SegmentURL mediaRange="1209096-1273284"/>
                    <SegmentURL mediaRange="1273285-1337473"/>
                    <SegmentURL mediaRange="1337474-1401662"/>
                    <SegmentURL mediaRange="1401663-1465851"/>
                    <SegmentURL mediaRange="1465852-1530040"/>
                    <SegmentURL mediaRange="1530041-1594229"/>
                    <SegmentURL mediaRange="1594230-1658418"/>
                    <SegmentURL mediaRange="1658419-1722607"/>
                    <SegmentURL mediaRange="1722608-1786796"/>
                    <SegmentURL mediaRange="1786797-1850985"/>
                    <SegmentURL mediaRange="1850986-1915174"/>
                    <SegmentURL mediaRange="1915175-1979363"/>
                    <SegmentURL mediaRange="1979364-2043552"/>
                    <SegmentURL mediaRange="2043553-2107741"/>
                    <SegmentURL mediaRange="2107742-2171930"/>
                    <SegmentURL mediaRange="2171931-2236119"/>
                    <SegmentURL mediaRange="2236120-2300308"/>
                    <SegmentURL mediaRange="2300309-2364497"/>
                    <SegmentURL mediaRange="2364498-2428686"/>
                    <SegmentURL mediaRange="2428687-2492875"/>
                    <SegmentURL mediaRange="2492876-2559060"/>
                </SegmentList>
            </Representation>
            <Representation id="6" qualityRanking="2" codecs="opus" audioSamplingRate="48000" bandwidth="196953" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/8e453bd1-9428-30fa-940f-fa85911368c2.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=SD_MEDIUM&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="48000" duration="480000">
                    <Initialization range="0-1031"/>
                    <SegmentURL mediaRange="1544-242159"/>
                    <SegmentURL mediaRange="242160-482295"/>
                    <SegmentURL mediaRange="482296-722431"/>
                    <SegmentURL mediaRange="722432-966620"/>
                    <SegmentURL mediaRange="966621-1210809"/>
                    <SegmentURL mediaRange="1210810-1454998"/>
                    <SegmentURL mediaRange="1454999-1699187"/>
                    <SegmentURL mediaRange="1699188-1943376"/>
                    <SegmentURL mediaRange="1943377-2187565"/>
                    <SegmentURL mediaRange="2187566-2431754"/>
                    <SegmentURL mediaRange="2431755-2675943"/>
                    <SegmentURL mediaRange="2675944-2920132"/>
                    <SegmentURL mediaRange="2920133-3164321"/>
                    <SegmentURL mediaRange="3164322-3408510"/>
                    <SegmentURL mediaRange="3408511-3652699"/>
                    <SegmentURL mediaRange="3652700-3896888"/>
                    <SegmentURL mediaRange="3896889-4141077"/>
                    <SegmentURL mediaRange="4141078-4385266"/>
                    <SegmentURL mediaRange="4385267-4629455"/>
                    <SegmentURL mediaRange="4629456-4873644"/>
                    <SegmentURL mediaRange="4873645-5117833"/>
                    <SegmentURL mediaRange="5117834-5362022"/>
                    <SegmentURL mediaRange="5362023-5606211"/>
                    <SegmentURL mediaRange="5606212-5850400"/>
                    <SegmentURL mediaRange="5850401-6094589"/>
                    <SegmentURL mediaRange="6094590-6338778"/>
                    <SegmentURL mediaRange="6338779-6582967"/>
                    <SegmentURL mediaRange="6582968-6827156"/>
                    <SegmentURL mediaRange="6827157-7071345"/>
                    <SegmentURL mediaRange="7071346-7315534"/>
                    <SegmentURL mediaRange="7315535-7559723"/>
                    <SegmentURL mediaRange="7559724-7803912"/>
                    <SegmentURL mediaRange="7803913-8048101"/>
                    <SegmentURL mediaRange="8048102-8292290"/>
                    <SegmentURL mediaRange="8292291-8536479"/>
                    <SegmentURL mediaRange="8536480-8780668"/>
                    <SegmentURL mediaRange="8780669-9024857"/>
                    <SegmentURL mediaRange="9024858-9269046"/>
                    <SegmentURL mediaRange="9269047-9513235"/>
                    <SegmentURL mediaRange="9513236-9759420"/>
                </SegmentList>
            </Representation>
            <Representation id="7" qualityRanking="1" codecs="opus" audioSamplingRate="48000" bandwidth="324955" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/40ba3a06-d285-3130-838f-0c1508c1d18b.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=SD_HIGH&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="48000" duration="480000">
                    <Initialization range="0-1031"/>
                    <SegmentURL mediaRange="1544-402479"/>
                    <SegmentURL mediaRange="402480-802615"/>
                    <SegmentURL mediaRange="802616-1202751"/>
                    <SegmentURL mediaRange="1202752-1606940"/>
                    <SegmentURL mediaRange="1606941-2011129"/>
                    <SegmentURL mediaRange="2011130-2415318"/>
                    <SegmentURL mediaRange="2415319-2819507"/>
                    <SegmentURL mediaRange="2819508-3223696"/>
                    <SegmentURL mediaRange="3223697-3627885"/>
                    <SegmentURL mediaRange="3627886-4032074"/>
                    <SegmentURL mediaRange="4032075-4436263"/>
                    <SegmentURL mediaRange="4436264-4840452"/>
                    <SegmentURL mediaRange="4840453-5244641"/>
                    <SegmentURL mediaRange="5244642-5648830"/>
                    <SegmentURL mediaRange="5648831-6053019"/>
                    <SegmentURL mediaRange="6053020-6457208"/>
                    <SegmentURL mediaRange="6457209-6861397"/>
                    <SegmentURL mediaRange="6861398-7265586"/>
                    <SegmentURL mediaRange="7265587-7669775"/>
                    <SegmentURL mediaRange="7669776-8073964"/>
                    <SegmentURL mediaRange="8073965-8478153"/>
                    <SegmentURL mediaRange="8478154-8882342"/>
                    <SegmentURL mediaRange="8882343-9286531"/>
                    <SegmentURL mediaRange="9286532-9690720"/>
                    <SegmentURL mediaRange="9690721-10094909"/>
                    <SegmentURL mediaRange="10094910-10499098"/>
                    <SegmentURL mediaRange="10499099-10903287"/>
                    <SegmentURL mediaRange="10903288-11307476"/>
                    <SegmentURL mediaRange="11307477-11711665"/>
                    <SegmentURL mediaRange="11711666-12115854"/>
                    <SegmentURL mediaRange="12115855-12520043"/>
                    <SegmentURL mediaRange="12520044-12924232"/>
                    <SegmentURL mediaRange="12924233-13328421"/>
                    <SegmentURL mediaRange="13328422-13732610"/>
                    <SegmentURL mediaRange="13732611-14136799"/>
                    <SegmentURL mediaRange="14136800-14540988"/>
                    <SegmentURL mediaRange="14540989-14945177"/>
                    <SegmentURL mediaRange="14945178-15349366"/>
                    <SegmentURL mediaRange="15349367-15753555"/>
                    <SegmentURL mediaRange="15753556-16159740"/>
                </SegmentList>
            </Representation>
        </AdaptationSet>
        <AdaptationSet id="3" contentType="audio" selectionPriority="500">
            <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" cenc:default_KID="4e4c6e3a-d760-ffd5-78b0-3824890da09d" value="cenc"/>
            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
                <cenc:pssh>AAAAXXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAD0SEE5MbjrXYP/VeLA4JIkNoJ0aC0FtYXpvbk11c2ljIhxjaWQ6VGt4dU90ZGcvOVY0c0Rna2lRMmduUT09</cenc:pssh>
            </ContentProtection>
            <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:ProgramLoudness" value="-13.5 LUFS"/>
            <SupplementalProperty schemeIdUri="amz-music:trackType" value="LD"/>
            <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:AnchorLoudness" value="-11.7 LUFS"/>
            <Representation id="8" qualityRanking="2000" codecs="opus" audioSamplingRate="48000" bandwidth="52950" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/748096ab-6991-368b-b9ca-5477bf90ba5a.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=LD_LOW&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="48000" duration="480000">
                    <Initialization range="0-1031"/>
                    <SegmentURL mediaRange="1544-61799"/>
                    <SegmentURL mediaRange="61800-121935"/>
                    <SegmentURL mediaRange="121936-182071"/>
                    <SegmentURL mediaRange="182072-246260"/>
                    <SegmentURL mediaRange="246261-310449"/>
                    <SegmentURL mediaRange="310450-374638"/>
                    <SegmentURL mediaRange="374639-438827"/>
                    <SegmentURL mediaRange="438828-503016"/>
                    <SegmentURL mediaRange="503017-567205"/>
                    <SegmentURL mediaRange="567206-631394"/>
                    <SegmentURL mediaRange="631395-695583"/>
                    <SegmentURL mediaRange="695584-759772"/>
                    <SegmentURL mediaRange="759773-823961"/>
                    <SegmentURL mediaRange="823962-888150"/>
                    <SegmentURL mediaRange="888151-952339"/>
                    <SegmentURL mediaRange="952340-1016528"/>
                    <SegmentURL mediaRange="1016529-1080717"/>
                    <SegmentURL mediaRange="1080718-1144906"/>
                    <SegmentURL mediaRange="1144907-1209095"/>
                    <SegmentURL mediaRange="1209096-1273284"/>
                    <SegmentURL mediaRange="1273285-1337473"/>
                    <SegmentURL mediaRange="1337474-1401662"/>
                    <SegmentURL mediaRange="1401663-1465851"/>
                    <SegmentURL mediaRange="1465852-1530040"/>
                    <SegmentURL mediaRange="1530041-1594229"/>
                    <SegmentURL mediaRange="1594230-1658418"/>
                    <SegmentURL mediaRange="1658419-1722607"/>
                    <SegmentURL mediaRange="1722608-1786796"/>
                    <SegmentURL mediaRange="1786797-1850985"/>
                    <SegmentURL mediaRange="1850986-1915174"/>
                    <SegmentURL mediaRange="1915175-1979363"/>
                    <SegmentURL mediaRange="1979364-2043552"/>
                    <SegmentURL mediaRange="2043553-2107741"/>
                    <SegmentURL mediaRange="2107742-2171930"/>
                    <SegmentURL mediaRange="2171931-2236119"/>
                    <SegmentURL mediaRange="2236120-2300308"/>
                    <SegmentURL mediaRange="2300309-2364497"/>
                    <SegmentURL mediaRange="2364498-2428686"/>
                    <SegmentURL mediaRange="2428687-2492875"/>
                    <SegmentURL mediaRange="2492876-2559060"/>
                </SegmentList>
            </Representation>
            <Representation id="9" qualityRanking="1000" codecs="opus" audioSamplingRate="48000" bandwidth="164952" mimeType="audio/mp4">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <BaseURL>https://d17vo8z6jop21h.cloudfront.net/94bd1ece-d200000391583662/8be307d6-71ea-3111-a869-40720e08a6f9.mp4?r=2e86bfd7-93aa-48a0-9d32-7bee6d2897a4&amp;rs=NA&amp;mt=US&amp;ql=LD_MEDIUM&amp;dtype=A16ZV8BU3SN1N3</BaseURL>
                <SegmentList timescale="48000" duration="480000">
                    <Initialization range="0-1031"/>
                    <SegmentURL mediaRange="1544-202079"/>
                    <SegmentURL mediaRange="202080-402215"/>
                    <SegmentURL mediaRange="402216-602351"/>
                    <SegmentURL mediaRange="602352-806540"/>
                    <SegmentURL mediaRange="806541-1010729"/>
                    <SegmentURL mediaRange="1010730-1214918"/>
                    <SegmentURL mediaRange="1214919-1419107"/>
                    <SegmentURL mediaRange="1419108-1623296"/>
                    <SegmentURL mediaRange="1623297-1827485"/>
                    <SegmentURL mediaRange="1827486-2031674"/>
                    <SegmentURL mediaRange="2031675-2235863"/>
                    <SegmentURL mediaRange="2235864-2440052"/>
                    <SegmentURL mediaRange="2440053-2644241"/>
                    <SegmentURL mediaRange="2644242-2848430"/>
                    <SegmentURL mediaRange="2848431-3052619"/>
                    <SegmentURL mediaRange="3052620-3256808"/>
                    <SegmentURL mediaRange="3256809-3460997"/>
                    <SegmentURL mediaRange="3460998-3665186"/>
                    <SegmentURL mediaRange="3665187-3869375"/>
                    <SegmentURL mediaRange="3869376-4073564"/>
                    <SegmentURL mediaRange="4073565-4277753"/>
                    <SegmentURL mediaRange="4277754-4481942"/>
                    <SegmentURL mediaRange="4481943-4686131"/>
                    <SegmentURL mediaRange="4686132-4890320"/>
                    <SegmentURL mediaRange="4890321-5094509"/>
                    <SegmentURL mediaRange="5094510-5298698"/>
                    <SegmentURL mediaRange="5298699-5502887"/>
                    <SegmentURL mediaRange="5502888-5707076"/>
                    <SegmentURL mediaRange="5707077-5911265"/>
                    <SegmentURL mediaRange="5911266-6115454"/>
                    <SegmentURL mediaRange="6115455-6319643"/>
                    <SegmentURL mediaRange="6319644-6523832"/>
                    <SegmentURL mediaRange="6523833-6728021"/>
                    <SegmentURL mediaRange="6728022-6932210"/>
                    <SegmentURL mediaRange="6932211-7136399"/>
                    <SegmentURL mediaRange="7136400-7340588"/>
                    <SegmentURL mediaRange="7340589-7544777"/>
                    <SegmentURL mediaRange="7544778-7748966"/>
                    <SegmentURL mediaRange="7748967-7953155"/>
                    <SegmentURL mediaRange="7953156-8159340"/>
                </SegmentList>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>`
