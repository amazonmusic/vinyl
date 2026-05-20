/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDashManifestProvider } from '@amazon/vinyl'

import createSpy = jasmine.createSpy

describe('createDashManifestProvider', () => {
    it('returns provided manifestProvider when available', () => {
        const mockManifestProvider = createSpy('manifestProvider')
        const loadOptions = {
            uri: 'test://manifest.mpd',
            type: 'dash' as const,
            manifestProvider: mockManifestProvider,
        }

        const provider = createDashManifestProvider(loadOptions)({
            requestInterceptor: {} as any,
        })

        expect(provider).toBe(mockManifestProvider)
    })

    it('creates urlDashManifestProvider when manifestProvider not provided', () => {
        const loadOptions = {
            uri: 'test://manifest.mpd',
            type: 'dash' as const,
            requestInit: { headers: { test: 'header' } },
        }

        const provider = createDashManifestProvider(loadOptions)({
            requestInterceptor: {} as any,
        })

        expect(provider).toEqual(jasmine.any(Function))
    })
})
