/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseDashManifest } from '@amazon/vinyl-mpd-parser'

describe('parseDashManifest remote elements', () => {
    it('parses xlink attributes in the XLink namespace', () => {
        const manifest =
            parseDashManifest(`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xlink="http://www.w3.org/1999/xlink"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT2S">
    <Period id="remote" xlink:href="https://ads.example.com/period.xml" xlink:actuate="onLoad"/>
    <Period id="late" xlink:href="late.xml">
        <AdaptationSet xlink:href="as.xml"/>
    </Period>
    <Period id="local" href="not-xlink.xml"/>
</MPD>`)
        const [remote, late, local] = manifest.MPD.Period
        expect(remote.href).toBe('https://ads.example.com/period.xml')
        expect(remote.actuate).toBe('onLoad')
        expect(late.href).toBe('late.xml')
        expect(late.actuate).toBe('onRequest')
        expect(late.AdaptationSet![0].href).toBe('as.xml')
        // An un-namespaced href is not an XLink.
        expect(local.href).toBeUndefined()
    })

    it('parses list MPDs and imported MPDs', () => {
        const manifest =
            parseDashManifest(`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="list"
     profiles="urn:mpeg:dash:profile:list:2024" minBufferTime="PT1S">
    <Period id="ad_01" duration="PT15S">
        <ImportedMPD earliestResolutionTimeOffset="5">creative_101.mpd</ImportedMPD>
    </Period>
</MPD>`)
        expect(manifest.MPD.type).toBe('list')
        expect(manifest.MPD.Period[0].ImportedMPD).toEqual(
            jasmine.objectContaining({
                earliestResolutionTimeOffset: 5,
                _content: 'creative_101.mpd',
            })
        )
    })
})
