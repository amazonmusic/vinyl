/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserAgentInfo } from '@amazon/vinyl-util'
import {
    Browser,
    emptyUserAgentInfo,
    hasBrowser,
    parseVersion,
    userAgentInfoRef,
} from '@amazon/vinyl-util'

describe('hasBrowser', () => {
    describe('when checkBrowserLike is true (default)', () => {
        describe('and userAgent.browserLike is defined', () => {
            function browserLikeInfo(
                browserName: Browser,
                versionStr?: string
            ): UserAgentInfo {
                return {
                    ...emptyUserAgentInfo,
                    browserLike: {
                        name: browserName,
                        version: parseVersion(versionStr),
                    },
                }
            }

            describe('and versions are not provided', () => {
                it('returns true if name matches browserLike.name', () => {
                    expect(
                        hasBrowser(Browser.WEBKIT, undefined, undefined, {
                            userAgentInfo: browserLikeInfo(Browser.WEBKIT),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.WEBKIT, undefined, undefined, {
                            userAgentInfo: browserLikeInfo(Browser.CHROMIUM),
                        })
                    ).toBeFalse()

                    expect(
                        hasBrowser(Browser.FIREFOX, undefined, undefined, {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '1'
                            ),
                            checkBrowserLike: true,
                        })
                    ).toBeTrue()
                })
            })

            describe('and minVersion is provided', () => {
                it('returns true if browserLike.version is at least provided min version', () => {
                    expect(
                        hasBrowser(Browser.FIREFOX, '1.0', undefined, {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '1.0'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.0', undefined, {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '1'
                            ),
                        })
                    ).toBeFalse()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.3', undefined, {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.3'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.3', undefined, {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.2'
                            ),
                        })
                    ).toBeFalse()

                    expect(
                        hasBrowser(Browser.SAFARI, '2.3.4.5', undefined, {
                            userAgentInfo: browserLikeInfo(
                                Browser.SAFARI,
                                '2.3.4.6'
                            ),
                        })
                    ).toBeTrue()
                })
            })

            describe('and maxVersion is provided', () => {
                it('returns true if browserLike.version is at most provided max version', () => {
                    expect(
                        hasBrowser(Browser.FIREFOX, undefined, '1.0', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '1'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, undefined, '1', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '1.2.3'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, undefined, '2.0', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '1'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, undefined, '2.3', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.3'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, undefined, '2.3', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.2'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.SAFARI, undefined, '2.3.4.5', {
                            userAgentInfo: browserLikeInfo(
                                Browser.SAFARI,
                                '2.3.4.6'
                            ),
                        })
                    ).toBeFalse()

                    expect(
                        hasBrowser(Browser.SAFARI, undefined, '2.3.4.5', {
                            userAgentInfo: browserLikeInfo(
                                Browser.SAFARI,
                                '2.3.4.5'
                            ),
                        })
                    ).toBeTrue()
                })
            })

            describe('and minVersion and maxVersion is provided', () => {
                it('returns version is in range', () => {
                    expect(
                        hasBrowser(Browser.FIREFOX, '2.4.2', '2.5.6', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.4.2'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.4.2', '2.5.6', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.5.6'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.4.2', '2.5.6', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.5.0'
                            ),
                        })
                    ).toBeTrue()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.4.2', '2.5.6', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.4.1'
                            ),
                        })
                    ).toBeFalse()

                    expect(
                        hasBrowser(Browser.FIREFOX, '2.4.2', '2.5.6', {
                            userAgentInfo: browserLikeInfo(
                                Browser.FIREFOX,
                                '2.5.8'
                            ),
                        })
                    ).toBeFalse()
                })
            })

            describe('and browserLike name does not match', () => {
                it('uses browser name', () => {
                    expect(
                        hasBrowser(Browser.SAFARI, null, null, {
                            userAgentInfo: {
                                ...emptyUserAgentInfo,
                                browserLike: {
                                    name: Browser.WEBKIT,
                                    version: null,
                                },
                                browser: {
                                    name: Browser.SAFARI,
                                    version: null,
                                },
                            },
                        })
                    ).toBeTrue()
                    expect(
                        hasBrowser(Browser.SAFARI, null, null, {
                            userAgentInfo: {
                                ...emptyUserAgentInfo,
                                browserLike: {
                                    name: Browser.WEBKIT,
                                    version: null,
                                },
                                browser: {
                                    name: Browser.WPE,
                                    version: null,
                                },
                            },
                        })
                    ).toBeFalse()
                    expect(
                        hasBrowser(Browser.SAFARI, null, null, {
                            userAgentInfo: emptyUserAgentInfo,
                        })
                    ).toBeFalse()
                })
            })
        })

        describe('and userAgent.browserLike is not defined', () => {
            it('matches only browser', () => {
                expect(
                    hasBrowser(Browser.SAFARI, null, null, {
                        userAgentInfo: {
                            ...emptyUserAgentInfo,
                            browserLike: {
                                name: Browser.SAFARI,
                                version: null,
                            },
                        },
                    })
                ).toBeTrue()
            })
        })
    })

    describe('when checkBrowserLike is false', () => {
        function browserInfo(
            browserName: Browser,
            versionStr?: string,
            browserLikeName?: Browser,
            browserLikeVersionStr?: string
        ): UserAgentInfo {
            return {
                ...emptyUserAgentInfo,
                browser: {
                    name: browserName,
                    version: parseVersion(versionStr),
                },
                browserLike:
                    browserLikeName == null
                        ? null
                        : {
                              name: browserLikeName,
                              version: parseVersion(browserLikeVersionStr),
                          },
            }
        }

        describe('and userAgent.browserLike matches name but browser does not', () => {
            it('returns false', () => {
                expect(
                    hasBrowser(Browser.WEBKIT, undefined, undefined, {
                        userAgentInfo: browserInfo(Browser.WEBKIT),
                        checkBrowserLike: false,
                    })
                ).toBeTrue()

                expect(
                    hasBrowser(Browser.WEBKIT, undefined, undefined, {
                        userAgentInfo: browserInfo(
                            Browser.SAFARI,
                            undefined,
                            Browser.WEBKIT
                        ),
                        checkBrowserLike: false,
                    })
                ).toBeFalse()
            })
        })
    })

    describe('when options.userAgentInfo is falsy', () => {
        it('uses global userAgentInfo reference', () => {
            userAgentInfoRef.reset()
            userAgentInfoRef.set(() => ({
                ...emptyUserAgentInfo,
                browserLike: {
                    name: Browser.FIREFOX,
                    version: null,
                },
            }))
            expect(hasBrowser(Browser.FIREFOX)).toBeTrue()
        })
    })
})
