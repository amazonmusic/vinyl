/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type DashUriResolveDeps,
    pickFirstBaseUrlSelector,
    resolveDashUri,
    segmentTemplateUrl,
} from '@amazon/vinyl'
import type { MutableDeep } from '@amazon/vinyl-util'
import { clone, ValidationError } from '@amazon/vinyl-util'
import type {
    AdaptationSetType,
    DashManifest,
    PeriodType,
    RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import { mockDashManifest } from '@amazon/vinyl/vinylTestUtil'

describe('resolveDashUri', () => {
    let manifest: MutableDeep<DashManifest>
    let period: MutableDeep<PeriodType>
    let adaptationSet: MutableDeep<AdaptationSetType>
    let representation: MutableDeep<RepresentationType>
    let deps: DashUriResolveDeps
    const baseUrl = 'https://example.com/'

    beforeEach(() => {
        deps = {
            baseUrlSelector: pickFirstBaseUrlSelector,
        }
        manifest = clone(mockDashManifest)
        period = manifest.MPD.Period[0]
        adaptationSet = period.AdaptationSet![0]
        representation = adaptationSet.Representation![0]
    })

    function setBaseUrls(
        mpdUri: string | null,
        periodUri: string | null,
        adaptationSetUri: string | null,
        representationUri: string | null
    ) {
        manifest.MPD.BaseURL = mpdUri ? [{ _content: mpdUri }] : []
        period.BaseURL = periodUri ? [{ _content: periodUri }] : []
        adaptationSet.BaseURL = adaptationSetUri
            ? [{ _content: adaptationSetUri }]
            : []
        representation.BaseURL = representationUri
            ? [{ _content: representationUri }]
            : []
    }

    describe('when baseURL is empty or missing and URI is missing', () => {
        it('rejects with a validation error', () => {
            {
                expect(() =>
                    resolveDashUri(deps, {
                        uri: null,
                        representation,
                        baseUrl,
                    })
                ).toThrowError(ValidationError, 'media missing URI or BaseURL')
            }
            {
                representation.BaseURL = []
                expect(() =>
                    resolveDashUri(deps, {
                        uri: null,
                        representation,
                        baseUrl,
                    })
                ).toThrowError(ValidationError, 'media missing URI or BaseURL')
            }
        })
    })

    describe('when there are BaseURL elements at each scope', () => {
        it('concatenates relative paths', () => {
            {
                setBaseUrls('foo/', 'bar/', 'baz/', 'bup.m3s')
                expect(
                    resolveDashUri(deps, {
                        uri: null,
                        representation,
                        baseUrl,
                    }).url
                ).toEqual('https://example.com/foo/bar/baz/bup.m3s')
            }

            {
                setBaseUrls('foo/', 'bar/', 'https://example.org', 'bup.m3s')
                expect(
                    resolveDashUri(deps, {
                        uri: null,
                        representation,
                        baseUrl,
                    }).url
                ).toEqual('https://example.org/bup.m3s')
            }

            {
                setBaseUrls('foo/', 'bar/', 'https://example.org', null)
                expect(
                    resolveDashUri(deps, {
                        uri: 'example.mp4',
                        representation,
                        baseUrl,
                    }).url
                ).toEqual('https://example.org/example.mp4')
            }

            {
                setBaseUrls(
                    'foo/',
                    'bar/',
                    'https://example.org',
                    'https://example.gov'
                )
                expect(
                    resolveDashUri(deps, {
                        uri: 'example.mp4',
                        representation,
                        baseUrl,
                    }).url
                ).toEqual('https://example.gov/example.mp4')
            }

            {
                setBaseUrls(null, null, null, null)
                expect(
                    resolveDashUri(deps, {
                        uri: 'example.mp4',
                        representation,
                        baseUrl,
                    }).url
                ).toEqual('https://example.com/example.mp4')
            }
        })

        it('returns serviceLocation defined at deepest level', () => {
            manifest.MPD.BaseURL = [
                { _content: '', serviceLocation: 'mpdLevel' },
            ]
            period.BaseURL = [{ _content: '', serviceLocation: 'periodLevel' }]
            representation.BaseURL = [
                { _content: '', serviceLocation: 'representationLevel' },
            ]

            expect(
                resolveDashUri(deps, {
                    uri: 'example.mp4',
                    representation,
                    baseUrl,
                }).serviceLocation
            ).toEqual('representationLevel')
        })
    })

    describe('segmentTemplateUrl', () => {
        it('replaces template tokens with provided values', () => {
            representation.id = 'RepId'
            representation.bandwidth = 948
            expect(
                segmentTemplateUrl(
                    '$RepresentationID$_$Time%05d$_$Number%02d$_$Bandwidth$',
                    {
                        representation,
                        segmentNumber: 23,
                        sampleTime: 2400,
                    }
                )
            ).toEqual('RepId_02400_23_948')

            expect(
                segmentTemplateUrl(
                    '$RepresentationID$_$Time%05d$_$Number%02d$_$Bandwidth$',
                    {
                        representation,
                    }
                )
            ).toEqual('RepId_00000_00_948')
        })

        describe('when provided an unsupported token', () => {
            it('throws a ValidationError', () => {
                expect(() =>
                    segmentTemplateUrl('$Unknown$', {
                        representation,
                    })
                ).toThrowError(ValidationError)
            })
        })

        describe('when a non IllegalArgumentError is caught', () => {
            it('throws original error', () => {
                expect(() =>
                    segmentTemplateUrl('$RepresentationID$', {
                        // @ts-expect-error Expected representation
                        representation: null,
                    })
                ).toThrowError(TypeError)
            })
        })
    })
})
