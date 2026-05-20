/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    filterDashAdaptationSets,
    filterDashRepresentations,
    manifestIsPlayable,
    mapManifestTransform,
    sortDashAdaptationSets,
    sortDashRepresentations,
} from '@amazon/vinyl'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { MediaUnsupportedError } from '@amazon/vinyl-util'
import { data } from '@amazon/vinyl-observable'

const manifest = parseDashManifest(
    // language=XML
    `<?xml version="1.0" ?>
    <MPD minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
        <Period>
            <AdaptationSet id="1" contentType="audio">
                <Representation id="10" bandwidth="100"/>
                <Representation id="20" bandwidth="200"/>
            </AdaptationSet>
            <AdaptationSet id="2" contentType="video">
                <Representation id="30" bandwidth="300"/>
            </AdaptationSet>
        </Period>
    </MPD>`
)

describe('manifestTransformUtils', () => {
    describe('manifestIsPlayable', () => {
        it('returns true when representations exist', () => {
            expect(manifestIsPlayable(manifest)).toBe(true)
        })

        it('returns false when no representations exist', () => {
            const empty = parseDashManifest(
                `<?xml version="1.0" ?>
                <MPD minBufferTime="PT0.0S" profiles="" xmlns="urn:mpeg:dash:schema:mpd:2011">
                    <Period><AdaptationSet/></Period>
                </MPD>`
            )
            expect(manifestIsPlayable(empty)).toBe(false)
        })
    })

    describe('filterDashRepresentations', () => {
        it('filters representations by predicate', () => {
            const result = filterDashRepresentations(
                (rep) => rep.bandwidth > 100,
                () => {
                    throw new MediaUnsupportedError('', '')
                },
                manifest
            )
            const ids =
                result.MPD.Period[0].AdaptationSet![0].Representation!.map(
                    (r) => r.id
                )
            expect(ids).toEqual(['20'])
        })

        it('throws when result is not playable', () => {
            expect(() =>
                filterDashRepresentations(
                    () => false,
                    () => {
                        throw new MediaUnsupportedError('none', 'none')
                    },
                    manifest
                )
            ).toThrowMatching((e) => e instanceof MediaUnsupportedError)
        })

        it('does not mutate the original manifest', () => {
            const originalCount =
                manifest.MPD.Period[0].AdaptationSet![0].Representation!.length
            filterDashRepresentations(
                (rep) => rep.bandwidth > 100,
                () => {
                    throw new MediaUnsupportedError('', '')
                },
                manifest
            )
            expect(
                manifest.MPD.Period[0].AdaptationSet![0].Representation!.length
            ).toBe(originalCount)
        })
    })

    describe('filterDashAdaptationSets', () => {
        it('filters adaptation sets by predicate', () => {
            const result = filterDashAdaptationSets(
                (as) => as.id === 1,
                () => {
                    throw new MediaUnsupportedError('', '')
                },
                manifest
            )
            expect(result.MPD.Period[0].AdaptationSet!.length).toBe(1)
            expect(result.MPD.Period[0].AdaptationSet![0].id).toBe(1)
        })

        it('throws when result is not playable', () => {
            expect(() =>
                filterDashAdaptationSets(
                    () => false,
                    () => {
                        throw new MediaUnsupportedError('none', 'none')
                    },
                    manifest
                )
            ).toThrowMatching((e) => e instanceof MediaUnsupportedError)
        })
    })

    describe('sortDashAdaptationSets', () => {
        it('sorts adaptation sets without mutating original', () => {
            const result = sortDashAdaptationSets(
                (a, b) => (b.id ?? 0) - (a.id ?? 0),
                manifest
            )
            expect(result.MPD.Period[0].AdaptationSet![0].id).toBe(2)
            expect(result.MPD.Period[0].AdaptationSet![1].id).toBe(1)
            expect(manifest.MPD.Period[0].AdaptationSet![0].id).toBe(1)
        })
    })

    describe('sortDashRepresentations', () => {
        it('sorts representations without mutating original', () => {
            const result = sortDashRepresentations(
                (a, b) => b.bandwidth - a.bandwidth,
                manifest
            )
            const ids =
                result.MPD.Period[0].AdaptationSet![0].Representation!.map(
                    (r) => r.id
                )
            expect(ids).toEqual(['20', '10'])
            expect(
                manifest.MPD.Period[0].AdaptationSet![0].Representation![0].id
            ).toBe('10')
        })
    })

    describe('mapManifestTransform', () => {
        const baseUrl = 'https://example.com/manifest.mpd'

        it('transforms manifest while preserving baseUrl', async () => {
            const manifestController = data(
                Promise.resolve({ manifest, baseUrl })
            )
            const result = mapManifestTransform(manifestController, (m) =>
                filterDashRepresentations(
                    (rep) => rep.bandwidth > 100,
                    () => {
                        throw new MediaUnsupportedError('', '')
                    },
                    m
                )
            )
            const { manifest: transformed, baseUrl: resultUrl } =
                await result.value
            expect(resultUrl).toBe(baseUrl)
            expect(
                transformed.MPD.Period[0].AdaptationSet![0].Representation!.map(
                    (r) => r.id
                )
            ).toEqual(['20'])
        })

        it('propagates transformation errors', async () => {
            const manifestController = data(
                Promise.resolve({ manifest, baseUrl })
            )
            const result = mapManifestTransform(manifestController, () => {
                throw new MediaUnsupportedError('none', 'none')
            })
            await expectAsync(result.value).toBeRejectedWithError()
        })

        it('propagates manifest controller errors', async () => {
            const manifestController = data(
                Promise.reject(new Error('load failed'))
            )
            const result = mapManifestTransform(manifestController, (m) => m)
            await expectAsync(result.value).toBeRejectedWithError('load failed')
        })
    })
})
