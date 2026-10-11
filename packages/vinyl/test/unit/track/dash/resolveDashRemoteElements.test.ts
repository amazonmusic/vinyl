/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    calculatePeriodStart,
    type DashManifestData,
    resolveDashRemoteElements,
    XLINK_RESOLVE_TO_ZERO,
} from '@amazon/vinyl'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { requesterWithRetryRef } from '@amazon/vinyl-util'
import { MockRequester } from '@amazon/vinyl-util/testUtil'

describe('resolveDashRemoteElements', () => {
    const BASE = 'https://cdn.example.com/content/'
    let mockRequester: MockRequester
    let documents: Record<string, string>

    beforeEach(() => {
        documents = {}
        mockRequester = new MockRequester()
        mockRequester.request.and.callFake((input) => {
            const url = String(input)
            return Promise.resolve(
                url in documents
                    ? new Response(documents[url])
                    : new Response('', { status: 404 })
            )
        })
        requesterWithRetryRef.set(() => mockRequester)
    })

    function mpd(body: string, attributes = '') {
        return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xlink="http://www.w3.org/1999/xlink"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT2S" ${attributes}>
    ${body}
</MPD>`
    }

    function data(body: string, attributes = ''): DashManifestData {
        return {
            manifest: parseDashManifest(mpd(body, attributes)),
            baseUrl: BASE,
        }
    }

    const ADAPTATION_SET = `<AdaptationSet id="1" contentType="audio" mimeType="audio/mp4">
        <Representation id="a" bandwidth="1000"><BaseURL>a.mp4</BaseURL></Representation>
    </AdaptationSet>`

    async function resolve(input: DashManifestData) {
        return resolveDashRemoteElements({}, input)
    }

    it('returns manifests without remote content as-is', async () => {
        const input = data(`<Period id="p">${ADAPTATION_SET}</Period>`)
        expect(await resolve(input)).toBe(input)
        expect(mockRequester.request).not.toHaveBeenCalled()
    })

    describe('Linked Periods', () => {
        function imported(period: string, attributes = '') {
            return mpd(
                `<BaseURL>media/</BaseURL>
                ${period}`,
                attributes
            )
        }

        it('imports the content of each Period of a list MPD', async () => {
            documents['https://ads.example.com/ad1.mpd'] = imported(
                `<Period id="imported" start="PT0S" duration="PT20S">
                    <BaseURL>p/</BaseURL>
                    <EventStream schemeIdUri="urn:a" value="1"/>
                    <SupplementalProperty schemeIdUri="urn:prop"/>
                    ${ADAPTATION_SET}
                </Period>`
            )
            documents[`${BASE}ad2.mpd`] = imported(
                `<Period duration="PT5S">${ADAPTATION_SET}</Period>`
            )
            const { manifest } = await resolve(
                data(
                    `<Period id="ad_01" duration="PT15S">
                        <EventStream schemeIdUri="urn:a" value="1"/>
                        <EventStream schemeIdUri="urn:b"/>
                        <SupplementalProperty schemeIdUri="urn:prop"/>
                        <ImportedMPD earliestResolutionTimeOffset="0">https://ads.example.com/ad1.mpd</ImportedMPD>
                    </Period>
                    <Period id="ad_02" duration="PT30S">
                        <ImportedMPD>ad2.mpd</ImportedMPD>
                    </Period>`,
                    'type="list"'
                )
            )
            const [first, second] = manifest.MPD.Period
            expect(first.id).toBe('ad_01')
            // The smaller of the two durations.
            expect(first.duration).toBe(15)
            expect(first.start).toBeUndefined()
            expect(first.ImportedMPD).toBeUndefined()
            expect(first.BaseURL?.map((b) => b._content)).toEqual([
                'https://ads.example.com/media/p/',
            ])
            expect(
                first.EventStream?.map((e) => [e.schemeIdUri, e.value])
            ).toEqual([
                ['urn:a', '1'],
                ['urn:b', undefined],
            ])
            expect(first.SupplementalProperty?.length).toBe(1)
            expect(first.AdaptationSet?.[0].parent).toBe(first)
            expect(first.parent).toBe(manifest.MPD)
            expect(second.duration).toBe(5)
            expect(second.BaseURL?.map((b) => b._content)).toEqual([
                `${BASE}media/`,
            ])
            expect(calculatePeriodStart(second)).toBe(15)
        })

        it('keeps the imported duration and start when the Linked Period has none', async () => {
            documents[`${BASE}a.mpd`] = mpd(
                `<Period duration="PT9S">${ADAPTATION_SET}</Period>`
            )
            const { manifest } = await resolve(
                data(
                    `<Period start="PT3S"><ImportedMPD>a.mpd</ImportedMPD></Period>`
                )
            )
            expect(manifest.MPD.Period[0].duration).toBe(9)
            expect(manifest.MPD.Period[0].start).toBe(3)
            expect(manifest.MPD.Period[0].BaseURL?.[0]._content).toBe(
                `${BASE}a.mpd`
            )
        })

        it('falls back to the regular Period, or removes it, when an import fails', async () => {
            documents[`${BASE}dynamic.mpd`] = mpd(
                `<Period>${ADAPTATION_SET}</Period>`,
                'type="dynamic" availabilityStartTime="2024-01-01T00:00:00Z"'
            )
            documents[`${BASE}two.mpd`] = mpd(
                `<Period>${ADAPTATION_SET}</Period><Period>${ADAPTATION_SET}</Period>`
            )
            documents[`${BASE}expired.mpd`] = mpd(
                `<Period>${ADAPTATION_SET}</Period>`,
                'availabilityEndTime="2000-01-01T00:00:00Z"'
            )
            documents[`${BASE}future.mpd`] = mpd(
                `<Period id="ok">${ADAPTATION_SET}</Period>`,
                'availabilityEndTime="2999-01-01T00:00:00Z"'
            )
            documents[`${BASE}invalid.mpd`] = 'not xml'
            const { manifest } = await resolve(
                data(`
                    <Period id="regular">${ADAPTATION_SET}<ImportedMPD>missing.mpd</ImportedMPD></Period>
                    <Period id="empty-href" duration="PT0S"><ImportedMPD> </ImportedMPD></Period>
                    <Period id="dynamic"><ImportedMPD>dynamic.mpd</ImportedMPD></Period>
                    <Period id="two"><ImportedMPD>two.mpd</ImportedMPD></Period>
                    <Period id="expired"><ImportedMPD>expired.mpd</ImportedMPD></Period>
                    <Period id="invalid"><ImportedMPD>invalid.mpd</ImportedMPD></Period>
                    <Period id="future"><ImportedMPD>future.mpd</ImportedMPD></Period>`)
            )
            expect(manifest.MPD.Period.map((p) => p.id)).toEqual([
                'regular',
                'empty-href',
                'future',
            ])
            expect(manifest.MPD.Period[0].ImportedMPD).toBeUndefined()
            expect(manifest.MPD.Period[0].AdaptationSet?.length).toBe(1)
        })
    })

    describe('remote elements', () => {
        it('replaces a remote Period with the fragment Periods', async () => {
            documents['https://ads.example.com/break.xml'] =
                `<?xml version="1.0"?>
                <Period id="ad1" start="PT10S" duration="PT5S">${ADAPTATION_SET}</Period>
                <Period id="ad2" start="PT15S" duration="PT5S">${ADAPTATION_SET}</Period>`
            const { manifest } = await resolve(
                data(`
                    <Period id="c1" start="PT0S" duration="PT10S">${ADAPTATION_SET}</Period>
                    <Period xlink:href="https://ads.example.com/break.xml" xlink:actuate="onRequest"/>
                    <Period id="c2" start="PT20S">${ADAPTATION_SET}</Period>`)
            )
            expect(manifest.MPD.Period.map((p) => p.id)).toEqual([
                'c1',
                'ad1',
                'ad2',
                'c2',
            ])
            expect(manifest.MPD.Period[1].parent).toBe(manifest.MPD)
            expect(manifest.MPD.Period[1].href).toBeUndefined()
            expect(manifest.MPD.Period[2].AdaptationSet?.[0].parent).toBe(
                manifest.MPD.Period[2]
            )
        })

        it('removes resolve-to-zero elements', async () => {
            const { manifest } = await resolve(
                data(`
                    <Period id="c1">${ADAPTATION_SET}</Period>
                    <Period xlink:href="${XLINK_RESOLVE_TO_ZERO}"/>`)
            )
            expect(manifest.MPD.Period.map((p) => p.id)).toEqual(['c1'])
        })

        it('resolves nested links against the referencing document', async () => {
            documents['https://a.example.com/x/first.xml'] =
                `<Period id="first">${ADAPTATION_SET}</Period>
                <Period xlink:href="second.xml"/>`
            documents['https://a.example.com/x/second.xml'] =
                `<Period id="second">${ADAPTATION_SET}</Period>`
            const { manifest } = await resolve(
                data(
                    `<Period xlink:href="https://a.example.com/x/first.xml" xlink:actuate="onLoad"/>`
                )
            )
            expect(manifest.MPD.Period.map((p) => p.id)).toEqual([
                'first',
                'second',
            ])
        })

        it('stops at the link depth limit', async () => {
            documents[`${BASE}loop.xml`] =
                `<Period id="loop" xlink:href="loop.xml">${ADAPTATION_SET}</Period>`
            const { manifest } = await resolve(
                data(`<Period xlink:href="loop.xml"/>`)
            )
            expect(manifest.MPD.Period.map((p) => p.id)).toEqual(['loop'])
            expect(manifest.MPD.Period[0].href).toBeUndefined()
            expect(mockRequester.request).toHaveBeenCalledTimes(5)
        })

        it('keeps the content of an element that fails to resolve', async () => {
            const { manifest } = await resolve(
                data(`
                    <Period id="kept" xlink:href="missing.xml">${ADAPTATION_SET}</Period>
                    <Period id="removed" xlink:href="missing.xml"/>`)
            )
            expect(manifest.MPD.Period.map((p) => p.id)).toEqual(['kept'])
            expect(manifest.MPD.Period[0].href).toBeUndefined()
        })

        it('resolves remote AdaptationSets, EventStreams, and SegmentLists', async () => {
            documents[`${BASE}as.xml`] = `${ADAPTATION_SET}${ADAPTATION_SET}`
            documents[`${BASE}events.xml`] =
                `<EventStream schemeIdUri="urn:remote"><Event presentationTime="1"/></EventStream>`
            documents[`${BASE}list.xml`] =
                `<SegmentList duration="2"><SegmentURL media="s1.m4s"/></SegmentList>`
            const { manifest } = await resolve(
                data(`
                    <Period id="p">
                        <SegmentList xlink:href="list.xml"/>
                        <EventStream schemeIdUri="urn:placeholder" xlink:href="events.xml"/>
                        <EventStream schemeIdUri="urn:zero" xlink:href="${XLINK_RESOLVE_TO_ZERO}"/>
                        <AdaptationSet xlink:href="as.xml"/>
                        <AdaptationSet id="9" contentType="video" mimeType="video/mp4">
                            <SegmentList xlink:href="list.xml"/>
                            <Representation id="v" bandwidth="1">
                                <SegmentList xlink:href="list.xml"/>
                            </Representation>
                            <Representation id="w" bandwidth="1">
                                <SegmentList xlink:href="${XLINK_RESOLVE_TO_ZERO}"/>
                            </Representation>
                        </AdaptationSet>
                    </Period>`)
            )
            const [period] = manifest.MPD.Period
            expect(period.SegmentList?.SegmentURL?.[0].media).toBe('s1.m4s')
            expect(period.EventStream?.map((e) => e.schemeIdUri)).toEqual([
                'urn:remote',
            ])
            expect(period.AdaptationSet?.map((a) => a.id)).toEqual([1, 1, 9])
            const video = period.AdaptationSet![2]
            expect(video.SegmentList?.duration).toBe(2)
            expect(video.Representation?.[0].SegmentList?.duration).toBe(2)
            expect(video.Representation?.[0].parent).toBe(video)
            expect(video.Representation?.[1].SegmentList).toBeUndefined()
            expect(period.AdaptationSet?.[0].parent).toBe(period)
        })

        it('removes elements whose fragment is empty', async () => {
            documents[`${BASE}empty.xml`] = ''
            const { manifest } = await resolve(
                data(`
                    <Period id="p">
                        <SegmentList xlink:href="empty.xml"/>
                        <EventStream schemeIdUri="x" xlink:href="empty.xml"/>
                        <AdaptationSet xlink:href="empty.xml"/>
                        ${ADAPTATION_SET}
                    </Period>
                    <Period id="zero" duration="PT0S"><ImportedMPD>zero.mpd</ImportedMPD></Period>`)
            )
            const [period, zero] = manifest.MPD.Period
            expect(period.SegmentList).toBeUndefined()
            expect(period.EventStream).toEqual([])
            expect(period.AdaptationSet?.length).toBe(1)
            expect(zero.id).toBe('zero')
        })

        it('imports a Period without AdaptationSets', async () => {
            documents[`${BASE}zero.mpd`] = mpd(`<Period duration="PT0S"/>`)
            const { manifest } = await resolve(
                data(
                    `<Period id="z"><ImportedMPD>zero.mpd</ImportedMPD></Period>`
                )
            )
            expect(manifest.MPD.Period[0].duration).toBe(0)
            expect(manifest.MPD.Period[0].AdaptationSet).toBeUndefined()
        })

        it('applies the request interceptor and init', async () => {
            documents[`${BASE}p.xml`] =
                `<Period id="p">${ADAPTATION_SET}</Period>`
            const interceptor = jasmine
                .createSpy('interceptor')
                .and.callFake((params) => {
                    params.init.headers = { token: 'x' }
                })
            await resolveDashRemoteElements(
                {
                    requestInterceptor: interceptor,
                    requestInit: { credentials: 'include' },
                },
                data(`<Period xlink:href="p.xml"/>`)
            )
            expect(mockRequester.request).toHaveBeenCalledOnceWith(
                `${BASE}p.xml`,
                { credentials: 'include', headers: { token: 'x' } },
                jasmine.anything()
            )
        })

        it('detects remote content in every supported position', async () => {
            for (const body of [
                `<Period><SegmentList xlink:href="${XLINK_RESOLVE_TO_ZERO}"/>${ADAPTATION_SET}</Period>`,
                `<Period><AdaptationSet xlink:href="${XLINK_RESOLVE_TO_ZERO}"/>${ADAPTATION_SET}</Period>`,
                `<Period>${ADAPTATION_SET}<AdaptationSet><SegmentList xlink:href="${XLINK_RESOLVE_TO_ZERO}"/></AdaptationSet></Period>`,
                `<Period>${ADAPTATION_SET}<AdaptationSet><Representation id="r" bandwidth="1"><SegmentList xlink:href="${XLINK_RESOLVE_TO_ZERO}"/></Representation></AdaptationSet></Period>`,
                `<Period><EventStream schemeIdUri="x" xlink:href="${XLINK_RESOLVE_TO_ZERO}"/>${ADAPTATION_SET}</Period>`,
            ]) {
                const input = data(body)
                expect(await resolve(input))
                    .withContext(body)
                    .not.toBe(input)
            }
            // A Period without remote content in any position.
            const plain = data(
                `<Period><EventStream schemeIdUri="x"/><AdaptationSet><Representation id="r" bandwidth="1"/></AdaptationSet><AdaptationSet/></Period><Period duration="PT0S"/>`
            )
            expect(await resolve(plain)).toBe(plain)
        })
    })
})
