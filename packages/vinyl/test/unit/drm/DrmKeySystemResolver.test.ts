/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentProtectionScheme } from '@amazon/vinyl-mpd-parser'
import { defaultDrmKeySystemResolver, DrmKeySystem } from '@amazon/vinyl'

describe('defaultDrmKeySystemResolver', () => {
    it('returns the matching DrmKeySystem from the ContentProtection schemeIdUri', () => {
        expect(
            defaultDrmKeySystemResolver(ContentProtectionScheme.WIDEVINE)
        ).toEqual([DrmKeySystem.WIDEVINE])
        expect(
            defaultDrmKeySystemResolver(ContentProtectionScheme.FAIR_PLAY)
        ).toEqual([DrmKeySystem.FAIR_PLAY, DrmKeySystem.FAIR_PLAY_1_0])
        expect(
            defaultDrmKeySystemResolver(ContentProtectionScheme.CENC)
        ).toEqual([])
    })
})
