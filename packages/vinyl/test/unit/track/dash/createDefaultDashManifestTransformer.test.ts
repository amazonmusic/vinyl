/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDefaultDashManifestTransformer,
    type DashManifestData,
} from '@amazon/vinyl'
import type { DashManifest } from '@amazon/vinyl-mpd-parser'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { clone } from '@amazon/vinyl-util'
import { data } from '@amazon/vinyl-observable'

const mockManifest = parseDashManifest(
    // language=XML
    `<?xml version="1.0"?>
    <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
        <Period>
            <AdaptationSet contentType="audio" id="1" segmentAlignment="true" selectionPriority="1">
                <Representation codecs="mp4a.40.2" bandwidth="48120" qualityRanking="1" id="p1a1r1"/>
                <Representation codecs="mp4a.40.2" bandwidth="256000" qualityRanking="2" id="p1a1r2"/>
                <Representation codecs="mp4a.40.2" bandwidth="320597" qualityRanking="3" id="p1a1r3"/>
            </AdaptationSet>
            <AdaptationSet contentType="audio" id="2" segmentAlignment="true" selectionPriority="3">
                <Representation codecs="flac" bandwidth="48120" qualityRanking="1" id="p1a2r1"/>
                <Representation codecs="flac" bandwidth="256000" qualityRanking="2" id="p1a2r2"/>
                <Representation codecs="flac" bandwidth="320597" qualityRanking="3" id="p1a2r3"/>
            </AdaptationSet>
            <AdaptationSet contentType="audio" id="3" segmentAlignment="true" selectionPriority="2">
                <Representation codecs="opus" bandwidth="48120" qualityRanking="1" id="p1a3r1"/>
                <Representation codecs="opus" bandwidth="256000" qualityRanking="2" id="p1a3r2"/>
                <Representation codecs="opus" bandwidth="320597" qualityRanking="3" id="p1a3r3"/>
            </AdaptationSet>
        </Period>
    </MPD>`
)

describe('createDefaultDashManifestTransformer', () => {
    async function transform(
        manifest: DashManifest
    ): Promise<DashManifestData> {
        const manifestAndPath: DashManifestData = {
            manifest,
            baseUrl: 'https://example.com',
        }
        const manifestController = data(Promise.resolve(manifestAndPath))
        const transformed = createDefaultDashManifestTransformer({
            manifestController,
        })
        return transformed.value
    }

    it('sorts adaptation sets by descending selectionPriority', async () => {
        const result = await transform(clone(mockManifest))
        const selectionPriorities = result.manifest.MPD.Period.map((period) =>
            (period.AdaptationSet ?? []).map((as) => as.selectionPriority)
        )
        expect(selectionPriorities).toEqual([[3, 2, 1]])
    })

    it('sorts representations by ascending qualityRanking', async () => {
        const result = await transform(clone(mockManifest))
        const qualityRanks = result.manifest.MPD.Period.map((period) =>
            (period.AdaptationSet ?? []).map((as) =>
                (as.Representation ?? []).map((r) => r.qualityRanking)
            )
        )
        expect(qualityRanks).toEqual([
            [
                [1, 2, 3],
                [1, 2, 3],
                [1, 2, 3],
            ],
        ])
    })

    it('orders by bandwidth descendingly when qualityRanking is not set', async () => {
        const manifest = clone(
            parseDashManifest(
                // language=XML
                `<?xml version="1.0"?>
    <MPD xmlns="urn:mpeg:dash:schema:mpd:2011" minBufferTime="PT10S" profiles="">
        <Period>
            <AdaptationSet contentType="audio" id="1" segmentAlignment="true">
                <Representation codecs="mp4a.40.2" bandwidth="48120" id="p1a1r1"/>
                <Representation codecs="mp4a.40.2" bandwidth="256000" id="p1a1r2"/>
                <Representation codecs="mp4a.40.2" bandwidth="320597" id="p1a1r3"/>
            </AdaptationSet>
        </Period>
    </MPD>`
            )
        )
        const result = await transform(manifest)
        const bandwidths =
            result.manifest.MPD.Period[0].AdaptationSet![0].Representation!.map(
                (rep) => rep.bandwidth
            )
        expect(bandwidths).toEqual([320597, 256000, 48120])
    })
})
