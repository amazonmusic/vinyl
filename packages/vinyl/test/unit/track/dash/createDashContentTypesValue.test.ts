/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    createDashContentTypesValue,
    type DashContentTypesValueDeps,
    type DashMediaQualityMetadataResolver,
    type DashManifestData,
} from '@amazon/vinyl'
import {
    parseDashManifest,
    type RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import { data } from '@amazon/vinyl-observable'

import createSpy = jasmine.createSpy

describe('createDashContentTypesValue', () => {
    let manifestData: ReturnType<typeof data<Promise<DashManifestData>>>
    let dashMediaQualityMetadataResolver: DashMediaQualityMetadataResolver
    let deps: DashContentTypesValueDeps

    beforeEach(() => {
        manifestData = data<Promise<DashManifestData>>(
            Promise.resolve({
                manifest: parseDashManifest(`<?xml version="1.0"?>
                    <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                        <Period/>
                    </MPD>`),
                baseUrl: 'https://example.com',
            })
        )
        dashMediaQualityMetadataResolver = createSpy(
            'mediaQualityMetadataResolver'
        ).and.callFake((rep: RepresentationType) => {
            return {
                ...createEmptyMediaQualityMetadata(),
                contentType: rep.parent.contentType,
            }
        })

        deps = {
            manifestTransformed: manifestData,
            mediaQualityMetadataResolver: dashMediaQualityMetadataResolver,
        }
    })

    function setManifest(xml: string) {
        const manifest = parseDashManifest(xml)
        manifestData.value = Promise.resolve({
            manifest,
            baseUrl: 'https://example.com',
        })
    }

    it('returns audio for audio-only content', async () => {
        setManifest(`<?xml version="1.0"?>
            <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                <Period>
                    <AdaptationSet contentType="audio">
                        <Representation id="audio1" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)

        const result = await createDashContentTypesValue(deps).value
        expect(result).toEqual(new Set(['audio']))
    })

    it('returns video for video-only content', async () => {
        setManifest(`<?xml version="1.0"?>
            <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                <Period>
                    <AdaptationSet contentType="video">
                        <Representation id="video1" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)

        const result = await createDashContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video']))
    })

    it('returns audio and video for mixed content', async () => {
        setManifest(`<?xml version="1.0"?>
            <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                <Period>
                    <AdaptationSet contentType="audio">
                        <Representation id="audio1" bandwidth="1"/>
                    </AdaptationSet>
                    <AdaptationSet contentType="video">
                        <Representation id="video1" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)

        const result = await createDashContentTypesValue(deps).value
        expect(result).toEqual(new Set(['audio', 'video']))
    })

    it('returns empty set for empty periods', async () => {
        setManifest(`<?xml version="1.0"?>
            <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                <Period/>
            </MPD>`)

        const result = await createDashContentTypesValue(deps).value
        expect(result).toEqual(new Set())
    })

    it('counts unique content types across periods', async () => {
        setManifest(`<?xml version="1.0"?>
            <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                <Period>
                    <AdaptationSet contentType="audio">
                        <Representation id="audio1" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
                <Period>
                    <AdaptationSet contentType="video">
                        <Representation id="video1" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)

        const result = await createDashContentTypesValue(deps).value
        expect(result).toEqual(new Set(['audio', 'video']))
    })

    it('deduplicates content types', async () => {
        setManifest(`<?xml version="1.0"?>
            <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
                <Period>
                    <AdaptationSet contentType="audio">
                        <Representation id="audio1" bandwidth="1"/>
                        <Representation id="audio2" bandwidth="1"/>
                    </AdaptationSet>
                    <AdaptationSet contentType="audio">
                        <Representation id="audio3" bandwidth="1"/>
                    </AdaptationSet>
                </Period>
            </MPD>`)

        const result = await createDashContentTypesValue(deps).value
        expect(result).toEqual(new Set(['audio']))
    })
})
