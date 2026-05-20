/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrmInitDataType } from '@amazon/vinyl'
import {
    DrmError,
    DrmKeySystem,
    MediaKeySessionErrorType,
    WebKitCommonEme,
    WebKitCommonMediaKeys,
    WebKitCommonMediaKeySession,
    WebKitCommonMediaKeySystemAccess,
    webkitErrorCodeToStr,
} from '@amazon/vinyl'
import type { Unsubscribe } from '@amazon/vinyl-util'
import { DisposedError, isNode, utf16ToUint16Array } from '@amazon/vinyl-util'
import {
    type EventFakesHandle,
    expectTypeEquals,
    implementEventFakes,
    MockHTMLAudioElement,
    mockEvent,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    MockWebKitMediaKeyError,
    MockWebKitMediaKeyMessageEvent,
    MockWebKitMediaKeys,
    MockWebKitMediaKeySession,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import createSpy = jasmine.createSpy

describe('WebkitCommonEme', () => {
    beforeEach(() => {
        if (!isNode()) pending('Cannot mock WebKit outside Node')
        ;(global as any).WebKitMediaKeys = MockWebKitMediaKeys
        ;(global as any).WebKitMediaKeySession = MockWebKitMediaKeySession
        ;(global as any).WebKitMediaKeyError = MockWebKitMediaKeyError
    })

    afterEach(() => {
        delete (global as any).WebKitMediaKeys
        delete (global as any).WebKitMediaKeySession
        delete (global as any).WebKitMediaKeyError
    })

    describe('WebKitCommonEme', () => {
        // intersection type is to get the global legacy interface extensions
        let mockAudioElement: MockHTMLAudioElement & HTMLAudioElement
        let mockAudioElementEventFakes: EventFakesHandle
        let webKitCommonEme: WebKitCommonEme

        beforeEach(() => {
            mockAudioElement = new MockHTMLAudioElement()
            mockAudioElement.webkitSetMediaKeys =
                createSpy('webkitSetMediaKeys')
            mockAudioElementEventFakes = implementEventFakes(mockAudioElement)
            webKitCommonEme = new WebKitCommonEme()
        })

        describe('requestMediaKeySystemAccess', () => {
            describe('requests access', () => {
                const keySystem = DrmKeySystem.WIDEVINE
                const supportedConfigurations = [
                    {
                        audioCapabilities: [
                            {
                                contentType: 'test',
                            },
                        ],
                    },
                ] as const satisfies MediaKeySystemConfiguration[]

                describe('with configs', () => {
                    describe('with audioCapabilities', () => {
                        describe('when isTypeSupported() returns true', () => {
                            beforeEach(() => {
                                MockWebKitMediaKeys.isTypeSupported.and.returnValue(
                                    true
                                )
                            })

                            it('returns system access object', async () => {
                                const access =
                                    await webKitCommonEme.requestMediaKeySystemAccess(
                                        keySystem,
                                        supportedConfigurations
                                    )
                                expect(access).toBeInstanceOf(
                                    WebKitCommonMediaKeySystemAccess
                                )
                                expect(access.keySystem).toBe(keySystem)
                            })
                        })

                        describe('when isTypeSupported() returns false', () => {
                            beforeEach(() => {
                                MockWebKitMediaKeys.isTypeSupported.and.returnValue(
                                    false
                                )
                            })

                            it('throws DrmError', async () => {
                                await expectAsync(
                                    webKitCommonEme.requestMediaKeySystemAccess(
                                        keySystem,
                                        supportedConfigurations
                                    )
                                ).toBeRejectedWithError(DrmError)
                            })
                        })
                    })

                    describe('without audioCapabilities', () => {
                        it('throws error', async () => {
                            await expectAsync(
                                webKitCommonEme.requestMediaKeySystemAccess(
                                    keySystem,
                                    [{}]
                                )
                            ).toBeRejectedWithError(
                                DrmError,
                                `keySystem not supported: com.widevine.alpha`
                            )
                        })
                    })

                    describe('with videoCapabilities only', () => {
                        const videoOnlyConfigurations = [
                            {
                                videoCapabilities: [
                                    {
                                        contentType: 'video/mp4',
                                    },
                                ],
                            },
                        ] as const satisfies MediaKeySystemConfiguration[]

                        describe('when isTypeSupported() returns true', () => {
                            beforeEach(() => {
                                MockWebKitMediaKeys.isTypeSupported.and.returnValue(
                                    true
                                )
                            })

                            it('returns system access object', async () => {
                                const access =
                                    await webKitCommonEme.requestMediaKeySystemAccess(
                                        keySystem,
                                        videoOnlyConfigurations
                                    )
                                expect(access).toBeInstanceOf(
                                    WebKitCommonMediaKeySystemAccess
                                )
                                expect(access.keySystem).toBe(keySystem)
                            })
                        })

                        describe('when isTypeSupported() returns false', () => {
                            beforeEach(() => {
                                MockWebKitMediaKeys.isTypeSupported.and.returnValue(
                                    false
                                )
                            })

                            it('throws DrmError', async () => {
                                await expectAsync(
                                    webKitCommonEme.requestMediaKeySystemAccess(
                                        keySystem,
                                        videoOnlyConfigurations
                                    )
                                ).toBeRejectedWithError(DrmError)
                            })
                        })
                    })

                    describe('with both audioCapabilities and videoCapabilities', () => {
                        const bothConfigurations = [
                            {
                                audioCapabilities: [
                                    {
                                        contentType: 'audio/mp4',
                                    },
                                ],
                                videoCapabilities: [
                                    {
                                        contentType: 'video/mp4',
                                    },
                                ],
                            },
                        ] as const satisfies MediaKeySystemConfiguration[]

                        it('checks all capabilities', async () => {
                            MockWebKitMediaKeys.isTypeSupported.and.returnValue(
                                true
                            )
                            await webKitCommonEme.requestMediaKeySystemAccess(
                                keySystem,
                                bothConfigurations
                            )
                            expect(
                                MockWebKitMediaKeys.isTypeSupported
                            ).toHaveBeenCalledWith(keySystem, 'audio/mp4')
                        })

                        it('succeeds when only videoCapabilities is supported', async () => {
                            MockWebKitMediaKeys.isTypeSupported.and.callFake(
                                (
                                    _ks: string,
                                    contentType: string | null | undefined
                                ) => contentType === 'video/mp4'
                            )
                            const access =
                                await webKitCommonEme.requestMediaKeySystemAccess(
                                    keySystem,
                                    bothConfigurations
                                )
                            expect(access).toBeInstanceOf(
                                WebKitCommonMediaKeySystemAccess
                            )
                        })
                    })
                })

                describe('without configs', () => {
                    it('throws DrmError', async () => {
                        await expectAsync(
                            webKitCommonEme.requestMediaKeySystemAccess(
                                keySystem,
                                []
                            )
                        ).toBeRejectedWithError(DrmError)
                    })
                })
            })
        })

        describe('addEncryptedListener', () => {
            it('adds a listener and returns an Unsubscribe handle', () => {
                expect(mockAudioElementEventFakes.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)

                const handler = jasmine.createSpy('handler')
                const encryptedSub = webKitCommonEme.addEncryptedListener(
                    mockAudioElement,
                    handler
                )
                expect(handler).not.toHaveBeenCalled()

                expectTypeEquals<typeof encryptedSub, Unsubscribe>(true)

                const encryptedEvent = mockEvent('webkitneedkey')
                mockAudioElement.dispatchEvent(encryptedEvent)
                expect(handler).toHaveBeenCalledOnceWith(encryptedEvent)

                encryptedSub()
                expect(mockAudioElementEventFakes.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
            })
        })
    })

    describe('WebKitCommonMediaKeySystemAccess', () => {
        const keySystem = DrmKeySystem.WIDEVINE
        let webKitCommonMediaKeySystemAccess: WebKitCommonMediaKeySystemAccess

        beforeEach(() => {
            webKitCommonMediaKeySystemAccess =
                new WebKitCommonMediaKeySystemAccess(keySystem)
        })

        it('creates media keys', async () => {
            const mediaKeys =
                await webKitCommonMediaKeySystemAccess.createMediaKeys()

            expect(mediaKeys)
                .withContext('mediaKeys instanceof WebKitCommonMediaKeys')
                .toBeInstanceOf(WebKitCommonMediaKeys)
            expect(mediaKeys.keySystem).toBe(keySystem)
        })
    })

    describe('WebKitCommonMediaKeys', () => {
        let mockAudioElement: MockHTMLAudioElement & HTMLAudioElement
        let mockWebKitMediaKeys: MockWebKitMediaKeys
        let webKitCommonMediaKeys: WebKitCommonMediaKeys

        beforeEach(() => {
            mockAudioElement = new MockHTMLAudioElement()
            mockAudioElement.webkitSetMediaKeys =
                createSpy('webkitSetMediaKeys')
            mockWebKitMediaKeys = new MockWebKitMediaKeys(DrmKeySystem.WIDEVINE)
            webKitCommonMediaKeys = new WebKitCommonMediaKeys(
                DrmKeySystem.WIDEVINE,
                mockWebKitMediaKeys
            )

            mockWebKitMediaKeys.createSession.and.callFake(() => {
                return new MockWebKitMediaKeySession()
            })
        })

        describe('setOnElement', () => {
            it('sets media keys on element', async () => {
                await webKitCommonMediaKeys.setOnElement(mockAudioElement)
                expect(
                    mockAudioElement.webkitSetMediaKeys
                ).toHaveBeenCalledOnceWith(mockWebKitMediaKeys)
            })
        })

        describe('clearFromElement', () => {
            it('clears media keys on element', async () => {
                await webKitCommonMediaKeys.clearFromElement(mockAudioElement)
                expect(
                    mockAudioElement.webkitSetMediaKeys
                ).toHaveBeenCalledOnceWith(null)
            })
        })

        describe('setServerCertificate', () => {
            it('resolves to false', async () => {
                await expectAsync(
                    webKitCommonMediaKeys.setServerCertificate(
                        new Uint8Array([1, 2, 3])
                    )
                ).toBeResolvedTo(false)
            })
        })

        describe('createSession', () => {
            const mimeType = 'mime'
            const uint16Array = utf16ToUint16Array('skd://example0')
            const uint8Array = new Uint8Array(uint16Array.buffer)

            it('creates session', () => {
                const session = webKitCommonMediaKeys.createSession(
                    mimeType,
                    'cenc',
                    uint8Array
                )
                expect(mockWebKitMediaKeys.createSession).toHaveBeenCalledTimes(
                    1
                )
                expect(session).toBeInstanceOf(WebKitCommonMediaKeySession)
            })
        })
    })

    describe('WebKitCommonMediaKeySession', () => {
        let mockWebKitMediaKeySession: MockWebKitMediaKeySession
        let mockWebKitMediaKeySessionEventFakes: EventFakesHandle
        let webKitCommonMediaKeySession: WebKitCommonMediaKeySession
        let mockWebKitMediaKeyError: MockWebKitMediaKeyError
        const mimeType = 'audio'
        const initDataType: DrmInitDataType = 'cenc'
        const initData = new Uint8Array([1, 2, 3])

        beforeEach(() => {
            mockWebKitMediaKeySession = new MockWebKitMediaKeySession()
            mockWebKitMediaKeySessionEventFakes = implementEventFakes(
                mockWebKitMediaKeySession
            )
            webKitCommonMediaKeySession = new WebKitCommonMediaKeySession(
                mockWebKitMediaKeySession,
                mimeType,
                initDataType,
                initData
            )
            mockWebKitMediaKeyError = new MockWebKitMediaKeyError()
        })

        it('adds event listener on session for webkitkeymessage event', () => {
            expect(
                mockWebKitMediaKeySession.addEventListener
            ).toHaveBeenCalled()

            const messageEventSpy = createEventSpy(
                webKitCommonMediaKeySession,
                'message'
            )
            const messageEvent = new MockWebKitMediaKeyMessageEvent()
            mockWebKitMediaKeySession.dispatchEvent(messageEvent)
            expect(messageEventSpy).toHaveBeenCalledOnceWith({
                message: messageEvent.message.buffer,
            })
        })

        describe('when an event listener is added for webkitkeyerror event', () => {
            describe('when session has error', () => {
                beforeEach(() => {
                    mockWebKitMediaKeySession.error =
                        new MockWebKitMediaKeyError()
                })

                afterEach(() => {
                    mockWebKitMediaKeySession.error = null
                })

                it('emits event', () => {
                    expect(
                        mockWebKitMediaKeySession.addEventListener
                    ).toHaveBeenCalled()

                    const messageEventSpy = createEventSpy(
                        webKitCommonMediaKeySession,
                        'error'
                    )

                    mockWebKitMediaKeySession.dispatchEvent(
                        mockWebKitMediaKeyError
                    )
                    expect(messageEventSpy).toHaveBeenCalled()
                })
            })

            describe('when session has no error', () => {
                it("doesn't emit event", () => {
                    const mockWebKitSession = new MockWebKitMediaKeySession()
                    implementEventFakes(mockWebKitSession)

                    const webkitCommonMediaKeySession =
                        new WebKitCommonMediaKeySession(
                            mockWebKitSession,
                            mimeType,
                            initDataType,
                            initData
                        )

                    expect(
                        mockWebKitSession.addEventListener
                    ).toHaveBeenCalled()

                    const messageEventSpy = createEventSpy(
                        webkitCommonMediaKeySession,
                        'error'
                    )

                    mockWebKitSession.dispatchEvent(mockWebKitMediaKeyError)
                    expect(messageEventSpy).not.toHaveBeenCalled()
                })
            })
        })

        describe('update', () => {
            it('rejects update when disposed', async () => {
                webKitCommonMediaKeySession.dispose()
                await expectAsync(
                    webKitCommonMediaKeySession.update(new ArrayBuffer(0))
                ).toBeRejectedWith(new DisposedError())
            })

            it('updates media key session', async () => {
                const arrayBuffer = new ArrayBuffer(0)
                await webKitCommonMediaKeySession.update(arrayBuffer)
                expect(
                    mockWebKitMediaKeySession.update
                ).toHaveBeenCalledOnceWith(new Uint8Array(arrayBuffer))
            })
        })

        describe('dispose', () => {
            it('removes listeners and closes session', () => {
                expect(webKitCommonMediaKeySession.disposed).toBeFalse()
                webKitCommonMediaKeySession.dispose()
                expect(webKitCommonMediaKeySession.disposed).toBeTrue()
                expect(mockWebKitMediaKeySessionEventFakes.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
                expect(
                    mockWebKitMediaKeySession.close
                ).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('webkitErrorCodeToStr', () => {
        it('translates value correctly', () => {
            expect(
                webkitErrorCodeToStr(WebKitMediaKeyError.MEDIA_KEYERR_CLIENT)
            ).toBe(MediaKeySessionErrorType.CLIENT)

            expect(
                webkitErrorCodeToStr(WebKitMediaKeyError.MEDIA_KEYERR_DOMAIN)
            ).toBe(MediaKeySessionErrorType.DOMAIN)

            expect(
                webkitErrorCodeToStr(
                    WebKitMediaKeyError.MEDIA_KEYERR_HARDWARECHANGE
                )
            ).toBe(MediaKeySessionErrorType.HARDWARECHANGE)

            expect(
                webkitErrorCodeToStr(WebKitMediaKeyError.MEDIA_KEYERR_OUTPUT)
            ).toBe(MediaKeySessionErrorType.OUTPUT)

            expect(
                webkitErrorCodeToStr(WebKitMediaKeyError.MEDIA_KEYERR_SERVICE)
            ).toBe(MediaKeySessionErrorType.SERVICE)

            expect(
                webkitErrorCodeToStr(WebKitMediaKeyError.MEDIA_KEYERR_UNKNOWN)
            ).toBe(MediaKeySessionErrorType.UNKNOWN)
        })
    })
})
