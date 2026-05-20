/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An Amazon catalog AAC track.
 * Uses SegmentList with SegmentURL without media ranges.
 */
// language=XML
export const dash_segmentList = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<MPD minBufferTime="PT10S" type="static" mediaPresentationDuration="PT2M59.515S" profiles="urn:mpeg:dash:profile:isoff-live:2011" xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:amz-music="urn:amazon:music:drm:2019" xmlns:cenc="urn:mpeg:cenc:2013" xmlns:mspr="urn:microsoft:playready">
    <Period>
        <AdaptationSet segmentAlignment="true" mimeType="audio/mp4" startWithSAP="1">
            <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" cenc:default_KID="5e2905f0-1f87-1c2a-cdc9-a698b13460a0" value="cenc"/>
            <ContentProtection schemeIdUri="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95" value="2.0">
                <mspr:pro>gAIAAAEAAQB2AjwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AOABBAFUAcABYAG8AYwBmAEsAaAB6AE4AeQBhAGEAWQBzAFQAUgBnAG8AQQA9AD0APAAvAEsASQBEAD4APABDAEgARQBDAEsAUwBVAE0APgBvAHYAQwA0AFQAaQA0AFgAOQBRADAAPQA8AC8AQwBIAEUAQwBLAFMAVQBNAD4APABMAEEAXwBVAFIATAA+AGgAdAB0AHAAcwA6AC8ALwBtAHUAcwBpAGMALgBhAG0AYQB6AG8AbgAuAGMAbwBtAC8AZABtAGwAcwAvAGEAYwBxAHUAaQByAGUATABpAGMAZQBuAHMAZQA8AC8ATABBAF8AVQBSAEwAPgA8AC8ARABBAFQAQQA+ADwALwBXAFIATQBIAEUAQQBEAEUAUgA+AA==</mspr:pro>
                <cenc:pssh>AAACoHBzc2gAAAAAmgTweZhAQoarkuZb4IhflQAAAoCAAgAAAQABAHYCPABXAFIATQBIAEUAQQBEAEUAUgAgAHgAbQBsAG4AcwA9ACIAaAB0AHQAcAA6AC8ALwBzAGMAaABlAG0AYQBzAC4AbQBpAGMAcgBvAHMAbwBmAHQALgBjAG8AbQAvAEQAUgBNAC8AMgAwADAANwAvADAAMwAvAFAAbABhAHkAUgBlAGEAZAB5AEgAZQBhAGQAZQByACIAIAB2AGUAcgBzAGkAbwBuAD0AIgA0AC4AMAAuADAALgAwACIAPgA8AEQAQQBUAEEAPgA8AFAAUgBPAFQARQBDAFQASQBOAEYATwA+ADwASwBFAFkATABFAE4APgAxADYAPAAvAEsARQBZAEwARQBOAD4APABBAEwARwBJAEQAPgBBAEUAUwBDAFQAUgA8AC8AQQBMAEcASQBEAD4APAAvAFAAUgBPAFQARQBDAFQASQBOAEYATwA+ADwASwBJAEQAPgA4AEEAVQBwAFgAbwBjAGYASwBoAHoATgB5AGEAYQBZAHMAVABSAGcAbwBBAD0APQA8AC8ASwBJAEQAPgA8AEMASABFAEMASwBTAFUATQA+AG8AdgBDADQAVABpADQAWAA5AFEAMAA9ADwALwBDAEgARQBDAEsAUwBVAE0APgA8AEwAQQBfAFUAUgBMAD4AaAB0AHQAcABzADoALwAvAG0AdQBzAGkAYwAuAGEAbQBhAHoAbwBuAC4AYwBvAG0ALwBkAG0AbABzAC8AYQBjAHEAdQBpAHIAZQBMAGkAYwBlAG4AcwBlADwALwBMAEEAXwBVAFIATAA+ADwALwBEAEEAVABBAD4APAAvAFcAUgBNAEgARQBBAEQARQBSAD4A</cenc:pssh>
            </ContentProtection>
            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
                <cenc:pssh>AAAAZnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAEYIARIQXikF8B+HHCrNyaaYsTRgoBoLQW1hem9uTXVzaWMiHGNpZDpYaWtGOEIrSEhDck55YWFZc1RSZ29BPT0qBUFVRElP</cenc:pssh>
            </ContentProtection>
            <Representation id="48kbps" bitrate="48" codecs="mp4a.40.5" audioSamplingRate="44100" bandwidth="49207">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SegmentList timescale="1000" duration="9999">
                    <Initialization sourceURL="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/e995b206-11e7-3b45-97c2-b6a3547d2f4e.mp4?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/7074f18b-9540-330a-afe2-219d0ce7833c.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/5f820f1c-2afc-3131-bed4-fb5bdef897f0.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/cd6c620a-04de-3782-92b2-c662b6c1072f.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/f7f821c5-5e35-3add-ad3a-9bbe0dbb1e3e.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/9746d8ad-cff5-3494-9496-81f4f55e1ef6.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/5f3f7a43-ab6d-3c3a-911b-eead57689bd6.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/fd21ca6a-2754-33ea-8880-6b5ef5b20ee4.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/d12751c0-7376-3f3e-93d4-aaa2e0604a27.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/deb6a2fe-cf1c-3cd3-b0c0-14605b19b6f7.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/b4f7e818-9b5d-3961-a30a-efb5662b4266.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/44654895-2ecc-3a8d-8314-b38554bd7cab.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/8bdf4924-bd51-376f-93f5-1a681f67b5f0.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/d376f5de-404a-3ec6-9c9b-ec4f1a0bb396.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/1cb253cb-53e0-3ce0-899e-66ab521b243e.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/5189c800-ada3-3851-af3f-1eb221eb1e46.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/aaba2b17-fb35-34ef-9e02-f5d4751537af.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/7c91714e-b106-3738-88b6-a6de127876ab.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/181177ec-f49d-3adf-9e54-54bc8829a4aa.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                </SegmentList>
            </Representation>
            <Representation id="128kbps" bitrate="128" codecs="mp4a.40.5" audioSamplingRate="44100" bandwidth="128940">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SegmentList timescale="1000" duration="9999">
                    <Initialization sourceURL="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/48ad8390-8f20-3375-ad88-a6b9e30443c9.mp4?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/b60dac8a-6ef4-3831-a94a-1c45fcee6b2d.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/657d1268-facc-3395-88e9-27c5c126ce48.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/5195eaa4-b1fe-35db-a6a2-f44b2f5c5ab3.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/4c03a31b-a7df-348f-85ba-849be71d8429.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/892c0d03-6f0a-3816-bab9-f086b1cc58ca.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/47997981-1b94-33a6-a49b-f213625515c0.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/4363a296-1ee3-386a-b866-bbc3209a70af.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/1080dd32-1782-3329-aa25-9f70425726f6.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/2afd08bd-9018-365e-a7ca-215ec749d5f4.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/db3c6e55-4dcd-32f4-9d86-d699760e37c9.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/38bc1afd-2930-3e41-809c-1c2472b2f7e2.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/df6643b3-5b9e-31cf-a3fa-e271e9f70040.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/6e833e36-ed37-3d57-8d2c-dbe058e04b9d.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/ec9caaf6-2205-3ef9-b456-b91fdea6991e.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/f1b8ccdf-9848-3b00-9d12-bab2ca18f857.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/da935cc3-be5e-3b3e-b1eb-7f91bd507a90.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/dbbae462-fd17-38d3-9b2a-ce25d1e67583.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/75b367ea-5dc3-3c95-8ff1-e727723ca423.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                </SegmentList>
            </Representation>
        </AdaptationSet>
        <AdaptationSet segmentAlignment="true" mimeType="audio/mp4" startWithSAP="1">
            <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" cenc:default_KID="5e2905f0-1f87-1c2a-cdc9-a698b13460a0" value="cenc"/>
            <ContentProtection schemeIdUri="urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95" value="2.0">
                <mspr:pro>gAIAAAEAAQB2AjwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AOABBAFUAcABYAG8AYwBmAEsAaAB6AE4AeQBhAGEAWQBzAFQAUgBnAG8AQQA9AD0APAAvAEsASQBEAD4APABDAEgARQBDAEsAUwBVAE0APgBvAHYAQwA0AFQAaQA0AFgAOQBRADAAPQA8AC8AQwBIAEUAQwBLAFMAVQBNAD4APABMAEEAXwBVAFIATAA+AGgAdAB0AHAAcwA6AC8ALwBtAHUAcwBpAGMALgBhAG0AYQB6AG8AbgAuAGMAbwBtAC8AZABtAGwAcwAvAGEAYwBxAHUAaQByAGUATABpAGMAZQBuAHMAZQA8AC8ATABBAF8AVQBSAEwAPgA8AC8ARABBAFQAQQA+ADwALwBXAFIATQBIAEUAQQBEAEUAUgA+AA==</mspr:pro>
                <cenc:pssh>AAACoHBzc2gAAAAAmgTweZhAQoarkuZb4IhflQAAAoCAAgAAAQABAHYCPABXAFIATQBIAEUAQQBEAEUAUgAgAHgAbQBsAG4AcwA9ACIAaAB0AHQAcAA6AC8ALwBzAGMAaABlAG0AYQBzAC4AbQBpAGMAcgBvAHMAbwBmAHQALgBjAG8AbQAvAEQAUgBNAC8AMgAwADAANwAvADAAMwAvAFAAbABhAHkAUgBlAGEAZAB5AEgAZQBhAGQAZQByACIAIAB2AGUAcgBzAGkAbwBuAD0AIgA0AC4AMAAuADAALgAwACIAPgA8AEQAQQBUAEEAPgA8AFAAUgBPAFQARQBDAFQASQBOAEYATwA+ADwASwBFAFkATABFAE4APgAxADYAPAAvAEsARQBZAEwARQBOAD4APABBAEwARwBJAEQAPgBBAEUAUwBDAFQAUgA8AC8AQQBMAEcASQBEAD4APAAvAFAAUgBPAFQARQBDAFQASQBOAEYATwA+ADwASwBJAEQAPgA4AEEAVQBwAFgAbwBjAGYASwBoAHoATgB5AGEAYQBZAHMAVABSAGcAbwBBAD0APQA8AC8ASwBJAEQAPgA8AEMASABFAEMASwBTAFUATQA+AG8AdgBDADQAVABpADQAWAA5AFEAMAA9ADwALwBDAEgARQBDAEsAUwBVAE0APgA8AEwAQQBfAFUAUgBMAD4AaAB0AHQAcABzADoALwAvAG0AdQBzAGkAYwAuAGEAbQBhAHoAbwBuAC4AYwBvAG0ALwBkAG0AbABzAC8AYQBjAHEAdQBpAHIAZQBMAGkAYwBlAG4AcwBlADwALwBMAEEAXwBVAFIATAA+ADwALwBEAEEAVABBAD4APAAvAFcAUgBNAEgARQBBAEQARQBSAD4A</cenc:pssh>
            </ContentProtection>
            <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed">
                <cenc:pssh>AAAAZnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAEYIARIQXikF8B+HHCrNyaaYsTRgoBoLQW1hem9uTXVzaWMiHGNpZDpYaWtGOEIrSEhDck55YWFZc1RSZ29BPT0qBUFVRElP</cenc:pssh>
            </ContentProtection>
            <Representation id="256kbps" bitrate="256" codecs="mp4a.40.2" audioSamplingRate="44100" bandwidth="257571">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
                <SegmentList timescale="1000" duration="10001">
                    <Initialization sourceURL="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/491172b7-47c7-3c85-8d21-d1b5932f17a2.mp4?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/826bac71-7b31-3a24-9d49-37847e2a6729.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/388d5f9e-91a8-3f11-af1a-ae4a05f97ec9.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/a33b04dd-497b-32a8-8d79-185c3ff64abc.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/5177f418-6081-3d74-962e-a22103b0bd9b.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/21130156-4c73-34e4-8d9f-3bb4835907f5.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/e38d0c76-959c-3ea2-9194-a909b79dcb2e.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/280aa567-f6e5-355b-910e-86dd3d877058.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/a00d6c29-4f5d-3fec-a925-238376fccb23.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/547acecd-34c8-308d-afa7-4cabfa08828a.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/dade48dd-b7b7-3584-8282-d485b4dcb4ac.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/06a7b39c-bf4c-3a84-8c3a-3130cf8d8796.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/e23e7877-351f-3907-bc21-5ad52e79bea3.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/8bd58682-d178-31e8-9158-647294632481.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/9940b7d6-a080-36e9-bc74-701bc86f1d04.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/d3f0bf8f-c7bb-390f-a69f-6c5f76fea173.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/85d1acbe-8bdb-3eb9-a6f1-dabbd39dcac7.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/55329bcb-7009-36c2-acc5-38100b7e7299.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                    <SegmentURL media="https://dfqzuzzcqflbd.cloudfront.net/4b931ac5-5bcb-4200000551204497/d12a306c-2d45-3e5b-8240-8ebea0437442.m4s?r=1ded475a-27b5-4a3d-848b-8e430140b3ed&amp;rs=NA&amp;mt=US"/>
                </SegmentList>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>
`
