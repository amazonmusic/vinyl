/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectsWidevine, STRICT_DRM_PARAM } from '@amazon/vinyl/vinylTestUtil'
import { parseUserAgent } from '@amazon/vinyl-util'

const userAgents = {
    chromeMac: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36`,
    chromeAndroid: `Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36`,
    edgeWindows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0`,
    firefoxWindows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0`,
    oldChrome: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36`,
    headlessChrome: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/142.0.0.0 Safari/537.36`,
    chromeIos: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1`,
    androidWebView: `Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36`,
    safariMac: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15`,
} as const

function expects(
    userAgent: keyof typeof userAgents,
    search = `?${STRICT_DRM_PARAM}=true`
): boolean {
    return expectsWidevine(
        parseUserAgent(userAgents[userAgent]),
        new URLSearchParams(search)
    )
}

describe('expectsWidevine', () => {
    it('expects Widevine on modern Chrome, headless Chrome, Edge, and Firefox', () => {
        expect(expects('chromeMac')).toBeTrue()
        expect(expects('chromeAndroid')).toBeTrue()
        expect(expects('edgeWindows')).toBeTrue()
        expect(expects('firefoxWindows')).toBeTrue()
        expect(expects('headlessChrome')).toBeTrue()
    })

    it("doesn't expect Widevine on browsers that may lack the CDM", () => {
        expect(expects('oldChrome')).toBeFalse()
        expect(expects('chromeIos')).toBeFalse()
        expect(expects('androidWebView')).toBeFalse()
        expect(expects('safariMac')).toBeFalse()
    })

    it(`doesn't expect Widevine unless ${STRICT_DRM_PARAM} is set`, () => {
        expect(expects('chromeMac', '')).toBeFalse()
        expect(expects('firefoxWindows', '')).toBeFalse()
    })
})
