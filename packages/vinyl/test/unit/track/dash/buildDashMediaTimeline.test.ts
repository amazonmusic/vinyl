/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildDashMediaTimeline, type DashManifestData } from '@amazon/vinyl'
import { noop } from '@amazon/vinyl-util'
import { dash_segmentList } from '@amazon/vinyl/vinylTestUtil'
import { pickFirstBaseUrlSelector } from '@amazon/vinyl'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'

describe('buildDashMediaTimeline', () => {
    const manifest = parseDashManifest(dash_segmentList)

    const deps = {
        mediaQualityMetadataResolver: jasmine
            .createSpy('resolver')
            .and.callFake((rep: any) => ({
                contentType: 'audio',
                qualityId: rep.id ?? 'q',
                decoderId: 'd',
                groupId: 'g',
                switchingGroupIds: null,
                mimeType: 'audio/mp4',
                codecs: 'mp4a.40.2',
                bandwidth: rep.bandwidth,
                bandwidthTotal: rep.bandwidth,
                audioSamplingRate: null,
                frameRate: null,
                height: null,
                width: null,
                lang: null,
                contentProtections: [],
                encryptionScheme: null,
                initDataType: null,
                supplementalProperties: {},
            })),
        requestInterceptor: noop,
        segmentRequestInit: undefined,
        baseUrlSelector: pickFirstBaseUrlSelector,
    }

    it('builds periods from manifest', () => {
        const data: DashManifestData = {
            manifest,
            baseUrl: 'https://example.com/',
        }
        const timeline = buildDashMediaTimeline(deps, data)
        expect(timeline.periods.length).toBe(manifest.MPD.Period.length)
        expect(timeline.minBufferTime).toBe(manifest.MPD.minBufferTime)
        expect(timeline.periods[0].qualities.length).toBeGreaterThan(0)
    })

    it('creates qualities with getSegment function', () => {
        const data: DashManifestData = {
            manifest,
            baseUrl: 'https://example.com/',
        }
        const timeline = buildDashMediaTimeline(deps, data)
        const quality = timeline.periods[0].qualities[0]
        expect(quality.getSegment).toEqual(jasmine.any(Function))
        expect(quality.metadata).toBeDefined()
    })

    it('quality getSegment returns a segment reference', async () => {
        const data: DashManifestData = {
            manifest,
            baseUrl: 'https://example.com/',
        }
        const timeline = buildDashMediaTimeline(deps, data)
        const quality = timeline.periods[0].qualities[0]
        const segment = await quality.getSegment(0)
        expect(segment).not.toBeNull()
        expect(segment!.startTime).toBeDefined()
        expect(segment!.initData).toBeDefined()
        expect(segment!.data).toBeDefined()
    })

    it('getDuration returns the manifest duration', async () => {
        const data: DashManifestData = {
            manifest,
            baseUrl: 'https://example.com/',
        }
        const timeline = buildDashMediaTimeline(deps, data)
        const duration = await timeline.getDuration()
        expect(duration).toEqual(jasmine.any(Number))
    })
})
