/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Browser,
    DeviceType,
    DeviceVendor,
    emptyUserAgentInfo,
    getUserAgentInfo,
    parseUserAgent,
    parseVersion,
    setUserAgent,
} from '@amazon/vinyl-util'
import { userAgentExpectations } from './userAgentExpectations'
import objectContaining = jasmine.objectContaining
import {
    setMockNavigator,
    spyOnPropertySafe,
} from '@amazon/vinyl-util/testUtil'

describe('UserAgent', () => {
    describe('parseUserAgent', () => {
        it('parses the provided user agent with default rules', () => {
            expect(
                parseUserAgent(
                    `Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0`
                )
            ).toEqual({
                userAgent:
                    'Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
                os: {
                    name: 'Linux',
                    version: null,
                },
                osLike: {
                    name: 'Linux',
                    version: null,
                },
                browser: {
                    name: 'Firefox',
                    version: parseVersion('102.0'),
                },
                browserLike: {
                    name: 'Firefox',
                    version: parseVersion('102.0'),
                },
                device: {
                    vendor: null,
                    model: null,
                    type: 'desktop',
                },
            })
            expect(
                parseUserAgent(
                    `Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-A530W) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.0 Chrome/87.0.4280.141`
                )
            ).toEqual({
                userAgent: `Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-A530W) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.0 Chrome/87.0.4280.141`,
                os: {
                    name: 'Android',
                    version: parseVersion('9'),
                },
                osLike: { name: 'Android OSP', version: parseVersion('9') },
                browser: {
                    name: Browser.SAMSUNG_BROWSER,
                    version: parseVersion('14.0'),
                },
                browserLike: {
                    name: Browser.CHROMIUM,
                    version: parseVersion('87.0.4280.141'),
                },
                device: {
                    vendor: DeviceVendor.SAMSUNG,
                    type: DeviceType.MOBILE,
                    model: 'SAMSUNG SM-A530W',
                },
            })
        })

        describe('defaultUserAgentRules', () => {
            it('matches browsers', () => {
                for (const browser of userAgentExpectations.browsers) {
                    const { uA, name, version, likeName, likeVersion } = browser
                    const parsed = parseUserAgent(uA)
                    expect(parsed.browser?.name ?? null)
                        .withContext(`Browser name for ${uA}`)
                        .toEqual(name)
                    expect(parsed.browser?.version?.str ?? null)
                        .withContext(`Browser version for ${uA}`)
                        .toEqual(version)
                    expect(parsed.browserLike?.name ?? null)
                        .withContext(`Like browser name for ${uA}`)
                        .toEqual(likeName ?? null)
                    if (likeVersion)
                        expect(parsed.browserLike?.version?.str ?? null)
                            .withContext(`Like browser version for ${uA}`)
                            .toEqual(likeVersion)
                }
            })

            it('matches oses', () => {
                for (const browser of userAgentExpectations.oses) {
                    const { uA, name, version, likeName, likeVersion } = browser
                    const parsed = parseUserAgent(uA)
                    expect(parsed.os?.name ?? null)
                        .withContext(`OS name for ${uA}`)
                        .toEqual(name)
                    expect(parsed.os?.version?.str ?? null)
                        .withContext(`OS version for ${uA}`)
                        .toEqual(version)
                    if (likeName)
                        expect(parsed.osLike?.name ?? null)
                            .withContext(`Like OS name for ${uA}`)
                            .toEqual(likeName)
                    if (likeVersion)
                        expect(parsed.osLike?.version?.str ?? null)
                            .withContext(`Like OS version for ${uA}`)
                            .toEqual(likeVersion)
                }
            })

            it('matches devices', () => {
                for (const browser of userAgentExpectations.devices) {
                    const { uA, vendor, model, type } = browser
                    const parsed = parseUserAgent(uA)
                    expect(parsed.device?.vendor ?? null)
                        .withContext(`Device vendor for ${uA}`)
                        .toEqual(vendor)
                    expect(parsed.device?.model ?? null)
                        .withContext(`Device model for ${uA}`)
                        .toEqual(model)
                    expect(parsed.device?.type ?? null)
                        .withContext(`Device type for ${uA}`)
                        .toEqual(type)
                }
            })
        })
    })

    describe('when provided userAgent is undefined', () => {
        describe('and navigator is defined', () => {
            beforeEach(() => {
                const navigator = setMockNavigator()
                navigator.userAgent = '123'
            })

            it('returns a parsed navigator.userAgent', () => {
                expect(parseUserAgent()).toEqual(
                    objectContaining({
                        userAgent: '123',
                    })
                )
            })
        })

        describe('and navigator is not defined', () => {
            beforeEach(() => {
                spyOnPropertySafe(global, 'navigator').and.returnValue(
                    // @ts-expect-error Simulating older node environments.
                    undefined
                )
            })

            it('returns empty userAgentInfo', () => {
                expect(parseUserAgent()).toEqual(emptyUserAgentInfo)
            })
        })
    })
})

describe('when user agent is null', () => {
    it('returns an empty user agent', () => {
        expect(parseUserAgent(null)).toEqual(emptyUserAgentInfo)
    })
})

describe('getUserAgentInfo', () => {
    it('returns the parsed user agent', () => {
        expect(getUserAgentInfo()).toEqual(parseUserAgent())
    })
})

describe('setUserAgent', () => {
    it('sets the user agent info to the parsed user agent', () => {
        setUserAgent('Firefox')
        expect(getUserAgentInfo().userAgent).toEqual('Firefox')
        setUserAgent('Chrome')
        expect(getUserAgentInfo().userAgent).toEqual('Chrome')
    })
})
