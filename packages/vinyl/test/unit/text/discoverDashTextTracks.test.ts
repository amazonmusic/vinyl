/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { discoverDashTextTracks } from '@amazon/vinyl'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'

describe('discoverDashTextTracks', () => {
    const baseUrl = 'https://example.com/dash/'

    function manifest(
        adaptationSets: string
    ): ReturnType<typeof parseDashManifest> {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" mediaPresentationDuration="PT60S" minBufferTime="PT2S">
  <Period>
    ${adaptationSets}
  </Period>
</MPD>`
        return parseDashManifest(xml)
    }

    it('discovers a text AdaptationSet by contentType', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" lang="en" mimeType="text/vtt">
              <Representation id="en-sub" bandwidth="100">
                <BaseURL>subs/en.vtt</BaseURL>
              </Representation>
            </AdaptationSet>`)
        const result = discoverDashTextTracks(m, baseUrl)
        expect(result.length).toBe(1)
        expect(result[0]).toEqual(
            jasmine.objectContaining({
                kind: 'subtitles',
                language: 'en',
                uri: 'https://example.com/dash/subs/en.vtt',
                mimeType: 'text/vtt',
            })
        )
    })

    it('discovers a text AdaptationSet by mimeType when contentType is absent', () => {
        const m = manifest(`
            <AdaptationSet mimeType="text/vtt" lang="es">
              <Representation id="es-sub" bandwidth="100">
                <BaseURL>es.vtt</BaseURL>
              </Representation>
            </AdaptationSet>`)
        const result = discoverDashTextTracks(m, baseUrl)
        expect(result.length).toBe(1)
        expect(result[0].language).toBe('es')
    })

    it('classifies kind=captions when role=caption is set', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" lang="en" mimeType="text/vtt">
              <Role schemeIdUri="urn:mpeg:dash:role:2011" value="caption"/>
              <Representation id="en-cap" bandwidth="100">
                <BaseURL>cc.vtt</BaseURL>
              </Representation>
            </AdaptationSet>`)
        const result = discoverDashTextTracks(m, baseUrl)
        expect(result[0].kind).toBe('captions')
    })

    it('marks default when role=main is set', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" lang="en" mimeType="text/vtt">
              <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
              <Representation id="r" bandwidth="100">
                <BaseURL>main.vtt</BaseURL>
              </Representation>
            </AdaptationSet>`)
        const result = discoverDashTextTracks(m, baseUrl)
        expect(result[0].default).toBeTrue()
    })

    it('skips AdaptationSets that are not text', () => {
        const m = manifest(`
            <AdaptationSet contentType="audio" mimeType="audio/mp4">
              <Representation id="a" bandwidth="48000"/>
            </AdaptationSet>`)
        expect(discoverDashTextTracks(m, baseUrl)).toEqual([])
    })

    it('skips text AdaptationSets carrying segmented codecs (stpp/wvtt)', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" mimeType="application/mp4" codecs="stpp">
              <Representation id="r" bandwidth="100">
                <BaseURL>stpp.mp4</BaseURL>
              </Representation>
            </AdaptationSet>`)
        expect(discoverDashTextTracks(m, baseUrl)).toEqual([])
    })

    it('falls back to representation id when no BaseURL is set on representation', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" mimeType="text/vtt" lang="fr">
              <BaseURL>subs/</BaseURL>
              <Representation id="fr-sub" bandwidth="100"/>
            </AdaptationSet>`)
        const result = discoverDashTextTracks(m, baseUrl)
        expect(result.length).toBe(1)
        expect(result[0].uri).toBe('https://example.com/dash/subs/fr-sub.vtt')
    })

    it('uses manifest path when AdaptationSet has no BaseURL', () => {
        const noTrailingSlashBase = 'https://example.com/manifest.mpd'
        const m = manifest(`
            <AdaptationSet contentType="text" mimeType="text/vtt" lang="fr">
              <Representation id="r" bandwidth="100"/>
            </AdaptationSet>`)
        // Without any BaseURL, the manifest URL is used as the base; since it
        // doesn't end with a slash, the discoverer falls back to that path
        // verbatim, which is rarely useful but should not throw.
        expect(discoverDashTextTracks(m, noTrailingSlashBase)[0].uri).toBe(
            noTrailingSlashBase
        )
    })

    it('respects nested BaseURL chain', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" mediaPresentationDuration="PT60S" minBufferTime="PT2S">
  <BaseURL>https://cdn.example.com/v1/</BaseURL>
  <Period>
    <BaseURL>p0/</BaseURL>
    <AdaptationSet contentType="text" mimeType="text/vtt" lang="ja">
      <BaseURL>texts/</BaseURL>
      <Representation id="ja" bandwidth="100">
        <BaseURL>ja.vtt</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`
        const result = discoverDashTextTracks(parseDashManifest(xml), baseUrl)
        expect(result[0].uri).toBe('https://cdn.example.com/v1/p0/texts/ja.vtt')
    })

    it('returns multiple tracks across periods', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" mediaPresentationDuration="PT120S" minBufferTime="PT2S">
  <Period>
    <AdaptationSet contentType="text" mimeType="text/vtt" lang="en">
      <Representation id="en" bandwidth="100">
        <BaseURL>en.vtt</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
  <Period start="PT60S">
    <AdaptationSet contentType="text" mimeType="text/vtt" lang="de">
      <Representation id="de" bandwidth="100">
        <BaseURL>de.vtt</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`
        const result = discoverDashTextTracks(parseDashManifest(xml), baseUrl)
        expect(result.length).toBe(2)
    })

    it('falls back to representation id as label when language is absent', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" mimeType="text/vtt">
              <Representation id="my-id" bandwidth="100">
                <BaseURL>x.vtt</BaseURL>
              </Representation>
            </AdaptationSet>`)
        const result = discoverDashTextTracks(m, baseUrl)
        expect(result[0].language).toBeNull()
        expect(result[0].label).toBe('my-id')
    })

    it('handles a Period with no AdaptationSet', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" mediaPresentationDuration="PT60S" minBufferTime="PT2S">
  <Period/>
</MPD>`
        expect(discoverDashTextTracks(parseDashManifest(xml), baseUrl)).toEqual(
            []
        )
    })

    it('handles a text AdaptationSet with no Representation', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" mimeType="text/vtt"/>`)
        expect(discoverDashTextTracks(m, baseUrl)).toEqual([])
    })

    it('treats missing mimeType as sidecar-eligible', () => {
        const m = manifest(`
            <AdaptationSet contentType="text" lang="en">
              <Representation id="r" bandwidth="100">
                <BaseURL>r.vtt</BaseURL>
              </Representation>
            </AdaptationSet>`)
        expect(discoverDashTextTracks(m, baseUrl).length).toBe(1)
    })
})
