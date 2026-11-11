/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Browser,
    getSearchParams,
    getUserAgentInfo,
    hasBrowser,
    Os,
    type UserAgentInfo,
} from '@amazon/vinyl-util'

/**
 * The test page query parameter that, set to 'true', makes Widevine specs fail
 * instead of going pending where {@link expectsWidevine}. Set it only on
 * runners whose browsers have their real CDMs, e.g. `--strictDrm=true` with the
 * local `chrome` and `msedge` browsers. BrowserStack's Firefox and Playwright's
 * Chromium and Firefox builds lack the Widevine CDM, so it's off by default.
 */
export const STRICT_DRM_PARAM = 'strictDrm'

/**
 * The minimum major version of the browsers {@link expectsWidevine} expects to
 * support Widevine.
 */
const MIN_VERSION = '100'

/**
 * Returns true if {@link STRICT_DRM_PARAM} is set and the browser is expected
 * to support Widevine: modern Chrome (including headless), Edge, and Firefox,
 * outside of iOS (where every browser is WebKit) and Android WebViews (where
 * EME depends on the host app).
 *
 * @param userAgentInfo The parsed user agent. Default: the browser's.
 * @param searchParams The test page's query parameters. Default: the browser's.
 */
export function expectsWidevine(
    userAgentInfo: UserAgentInfo = getUserAgentInfo(),
    searchParams: URLSearchParams = getSearchParams()
): boolean {
    if (searchParams.get(STRICT_DRM_PARAM) !== 'true') return false
    if (userAgentInfo.os?.name === Os.I_OS) return false
    if (/; wv\)/.test(userAgentInfo.userAgent)) return false
    const options = { checkBrowserLike: false, userAgentInfo } as const
    // Headless Chrome counts too: strict runs use the installed Chrome, whose
    // headless mode has the Widevine CDM, unlike Playwright's headless shell.
    return [
        Browser.CHROME,
        Browser.CHROME_HEADLESS,
        Browser.EDGE_CHROMIUM,
        Browser.FIREFOX,
    ].some((browser) => hasBrowser(browser, MIN_VERSION, null, options))
}
