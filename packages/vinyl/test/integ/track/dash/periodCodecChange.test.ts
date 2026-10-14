/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite } from '@amazon/vinyl/vinylTestUtil'
import { type DashTrackLoadOptions, supportsMse } from '@amazon/vinyl'
import { poll } from '@amazon/vinyl-util'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'

const SEGMENTS_BASE =
    'https://assets.dev.vinyl.music.amazon.dev/dash/vinyl_ad_breaks_av/segments/'

/**
 * A Period of four 2 s video segments of one rendition.
 */
function period(
    id: string,
    start: number,
    rendition: string,
    codecs: string,
    startNumber: number,
    mediaStart: number
): string {
    const timescale = 15360
    const t = mediaStart * timescale
    return `
  <Period id="${id}" start="PT${start}S" duration="PT8S">
    <AdaptationSet contentType="video" mimeType="video/mp4" segmentAlignment="true">
      <Representation id="${id}-video" bandwidth="1000000" codecs="${codecs}" width="640" height="360">
        <SegmentTemplate timescale="${timescale}" initialization="${rendition}/init.mp4" media="${rendition}/part_$Number$.m4s" startNumber="${startNumber}" presentationTimeOffset="${t}">
          <SegmentTimeline><S t="${t}" d="30720" r="3"/></SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>`
}

/**
 * Two Periods whose video changes codec at the boundary, the second starting 60 s into its media timeline. The
 * source buffer changes type at 8 s, and the next segment's media time (60 s) is far ahead of where it plays (8 s).
 */
const PERIOD_CODEC_CHANGE_MPD = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-live:2011" type="static" minBufferTime="PT2S" mediaPresentationDuration="PT16S">
${period('first', 0, 'libx264_640x360_30fps_600k', 'avc1.64001e', 1, 0)}
${period('second', 8, 'libx264_1280x720_30fps_1500k', 'avc1.64001f', 31, 60)}
</MPD>`

describe('dash Period codec change integ', () => {
    const suite = createVinylSuite({}, { timeout: 60 })

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
        if (!('changeType' in SourceBuffer.prototype))
            pending('SourceBuffer.changeType not supported')
    })

    const loadOptions: DashTrackLoadOptions = {
        type: 'dash',
        uri: 'test://period-codec-change',
        manifestProvider: () =>
            Promise.resolve({
                manifest: parseDashManifest(PERIOD_CODEC_CHANGE_MPD),
                baseUrl: SEGMENTS_BASE,
            }),
    }

    // WebKit appends after a changeType at the segment's media time instead of continuing in sequence (see
    // docs/ERRATA.md): https://bugs.webkit.org/show_bug.cgi?id=327788
    it('plays across a Period boundary that changes codec', async () => {
        const changeType = spyOn(
            SourceBuffer.prototype,
            'changeType'
        ).and.callThrough()
        const player = suite.player
        player.load(loadOptions)
        await player.play().catch(() => undefined)
        await player.seekTo(6, 0.5).catch(() => undefined)
        expect(await poll(() => player.currentTime >= 10, { timeout: 20 }))
            .withContext(`plays past the boundary (at ${player.currentTime})`)
            .toBeTrue()
        expect(changeType).toHaveBeenCalledWith(
            'video/mp4; codecs="avc1.64001f"'
        )
    })
})
