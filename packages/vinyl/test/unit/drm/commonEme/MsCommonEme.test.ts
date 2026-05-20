/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    DrmError,
    DrmKeySystem,
    MediaKeySessionErrorType,
    MsCommonEme,
    MsCommonMediaKeys,
    MsCommonMediaKeySession,
    MsCommonMediaKeySystemAccess,
    msErrorCodeToStr,
} from '@amazon/vinyl'
import type { Unsubscribe } from '@amazon/vinyl-util'
import { DisposedError, isNode, utf16ToUint16Array } from '@amazon/vinyl-util'
import {
    expectTypeEquals,
    implementEventFakes,
    MockHTMLAudioElement,
    mockEvent,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    MockMSMediaKeyError,
    MockMSMediaKeyMessageEvent,
    MockMSMediaKeys,
    MockMSMediaKeySession,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import createSpy = jasmine.createSpy
import type { EventFakesHandle } from '@amazon/vinyl-util/browserTestUtil'

describe('MsCommonEme', () => {
    beforeEach(() => {
        if (!isNode()) {
            pending('Cannot mock MS outside Node')
            return
        }
        ;(global as any).MSMediaKeys = MockMSMediaKeys
        ;(global as any).MSMediaKeySession = MockMSMediaKeySession
        ;(global as any).MSMediaKeyError = MockMSMediaKeyError
    })

    afterEach(() => {
        delete (global as any).MSMediaKeys
        delete (global as any).MSMediaKeySession
        delete (global as any).MSMediaKeyError
    })

    describe('MsCommonEme', () => {
        // intersection type is to get the global legacy interface extensions
        let mockAudioElement: MockHTMLAudioElement & HTMLAudioElement
        let mockAudioElementEvents: EventFakesHandle
        let msCommonEme: MsCommonEme

        beforeEach(() => {
            mockAudioElement = new MockHTMLAudioElement()
            mockAudioElement.msSetMediaKeys = createSpy('msSetMediaKeys')
            mockAudioElementEvents = implementEventFakes(mockAudioElement)
            msCommonEme = new MsCommonEme()
        })

        describe('requestMediaKeySystemAccess', () => {
            describe('requests access', () => {
                const keySystem = DrmKeySystem.WIDEVINE
                const supportedConfigurations = [
                    {},
                    {
                        audioCapabilities: [
                            {
                                contentType: 'test',
                            },
                        ],
                    },
                ] as const satisfies MediaKeySystemConfiguration[]

                describe('with configs', () => {
                    describe('when isTypeSupported returns true', () => {
                        beforeEach(() => {
                            MockMSMediaKeys.isTypeSupported.and.returnValue(
                                true
                            )
                        })

                        it('returns system access object', async () => {
                            const access =
                                await msCommonEme.requestMediaKeySystemAccess(
                                    keySystem,
                                    supportedConfigurations
                                )
                            expect(access).toBeInstanceOf(
                                MsCommonMediaKeySystemAccess
                            )
                            expect(access.keySystem).toBe(keySystem)
                        })
                    })

                    describe('when isTypeSupported() returns false', () => {
                        beforeEach(() => {
                            MockMSMediaKeys.isTypeSupported.and.returnValue(
                                false
                            )
                        })

                        it('throws MediaKeySystemAccessError', async () => {
                            await expectAsync(
                                msCommonEme.requestMediaKeySystemAccess(
                                    keySystem,
                                    supportedConfigurations
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

                        it('returns system access object when supported', async () => {
                            MockMSMediaKeys.isTypeSupported.and.returnValue(
                                true
                            )
                            const access =
                                await msCommonEme.requestMediaKeySystemAccess(
                                    keySystem,
                                    videoOnlyConfigurations
                                )
                            expect(access).toBeInstanceOf(
                                MsCommonMediaKeySystemAccess
                            )
                        })

                        it('throws DrmError when not supported', async () => {
                            MockMSMediaKeys.isTypeSupported.and.returnValue(
                                false
                            )
                            await expectAsync(
                                msCommonEme.requestMediaKeySystemAccess(
                                    keySystem,
                                    videoOnlyConfigurations
                                )
                            ).toBeRejectedWithError(DrmError)
                        })
                    })
                })
            })
        })

        describe('addEncryptedListener', () => {
            it('adds a listener and returns an Unsubscribe handle', () => {
                expect(mockAudioElementEvents.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
                const handler = createSpy('handler')

                const encryptedSub = msCommonEme.addEncryptedListener(
                    mockAudioElement,
                    handler
                )
                expect(handler).not.toHaveBeenCalled()

                expectTypeEquals<typeof encryptedSub, Unsubscribe>(true)

                const encryptedEvent = mockEvent('msneedkey')
                mockAudioElement.dispatchEvent(encryptedEvent)
                expect(handler).toHaveBeenCalledOnceWith(encryptedEvent)
                encryptedSub()

                expect(mockAudioElementEvents.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
            })
        })
    })

    describe('MsCommonMediaKeySystemAccess', () => {
        const keySystem = DrmKeySystem.WIDEVINE
        let msCommonMediaKeySystemAccess: MsCommonMediaKeySystemAccess

        beforeEach(() => {
            msCommonMediaKeySystemAccess = new MsCommonMediaKeySystemAccess(
                keySystem
            )
        })

        it('creates media keys', async () => {
            const mediaKeys =
                await msCommonMediaKeySystemAccess.createMediaKeys()

            expect(mediaKeys)
                .withContext('mediaKeys instanceof MsCommonMediaKeys')
                .toBeInstanceOf(MsCommonMediaKeys)
            expect(mediaKeys.keySystem).toBe(keySystem)
        })
    })

    describe('MsCommonMediaKeys', () => {
        let mockAudioElement: MockHTMLAudioElement & HTMLAudioElement
        let mockMsMediaKeys: MockMSMediaKeys
        let msCommonMediaKeys: MsCommonMediaKeys

        beforeEach(() => {
            mockAudioElement = new MockHTMLAudioElement()
            mockAudioElement.msSetMediaKeys = createSpy('msSetMediaKeys')

            mockMsMediaKeys = new MockMSMediaKeys(DrmKeySystem.WIDEVINE)
            msCommonMediaKeys = new MsCommonMediaKeys(
                DrmKeySystem.WIDEVINE,
                mockMsMediaKeys
            )
            mockMsMediaKeys.createSession.and.callFake(() => {
                return new MockMSMediaKeySession()
            })
        })

        describe('setOnElement', () => {
            it('sets media keys on element', async () => {
                await msCommonMediaKeys.setOnElement(mockAudioElement)
                expect(
                    mockAudioElement.msSetMediaKeys
                ).toHaveBeenCalledOnceWith(mockMsMediaKeys)
            })
        })

        describe('clearFromElement', () => {
            it('clears media keys on element', async () => {
                await msCommonMediaKeys.clearFromElement(mockAudioElement)
                expect(
                    mockAudioElement.msSetMediaKeys
                ).toHaveBeenCalledOnceWith(null)
            })
        })

        describe('setServerCertificate', () => {
            it('resolves to false', async () => {
                await expectAsync(
                    msCommonMediaKeys.setServerCertificate(
                        new Uint8Array([1, 2, 3])
                    )
                ).toBeResolvedTo(false)
            })
        })

        describe('createSession', () => {
            const uint16Array = utf16ToUint16Array('skd://example0')
            const uint8Array = new Uint8Array(uint16Array.buffer)

            it('creates a session', () => {
                const session0 = msCommonMediaKeys.createSession(
                    'audio/mp4; codecs="mp4a.40.2"',
                    'cenc',
                    uint8Array
                )
                expect(mockMsMediaKeys.createSession).toHaveBeenCalledOnceWith(
                    `audio/mp4; codecs="mp4a.40.2"`,
                    uint8Array
                )
                expect(session0).toBeInstanceOf(MsCommonMediaKeySession)
            })
        })
    })

    describe('MsCommonMediaKeySession', () => {
        let mockMsMediaKeySession: MockMSMediaKeySession
        let mockMsMediaKeySessionEvents: EventFakesHandle
        let msCommonMediaKeySession: MsCommonMediaKeySession
        let mockMsMediaKeyError: MockMSMediaKeyError
        const mimeType = 'audio'
        const initDataType = 'cenc'
        const initData = new Uint8Array([1, 2, 3])

        beforeEach(() => {
            mockMsMediaKeySession = new MockMSMediaKeySession()
            mockMsMediaKeySessionEvents = implementEventFakes(
                mockMsMediaKeySession
            )
            msCommonMediaKeySession = new MsCommonMediaKeySession(
                mockMsMediaKeySession,
                mimeType,
                initDataType,
                initData
            )
            mockMsMediaKeyError = new MockMSMediaKeyError()
        })

        it('adds event listener on session for mskeymessage event', () => {
            expect(mockMsMediaKeySession.addEventListener).toHaveBeenCalled()

            const messageEventSpy = createEventSpy(
                msCommonMediaKeySession,
                'message'
            )
            const messageEvent = new MockMSMediaKeyMessageEvent()
            mockMsMediaKeySession.dispatchEvent(messageEvent)
            expect(messageEventSpy).toHaveBeenCalledOnceWith({
                message: messageEvent.message.buffer,
            })
        })

        describe('when an event listener is added for webkitkeyerror event', () => {
            describe('when session has error', () => {
                beforeEach(() => {
                    mockMsMediaKeySession.error = new MSMediaKeyError()
                })

                afterEach(() => {
                    mockMsMediaKeySession.error = null
                })

                it('emits event', () => {
                    expect(
                        mockMsMediaKeySession.addEventListener
                    ).toHaveBeenCalled()

                    const messageEventSpy = createEventSpy(
                        msCommonMediaKeySession,
                        'error'
                    )

                    mockMsMediaKeySession.dispatchEvent(mockMsMediaKeyError)
                    expect(messageEventSpy).toHaveBeenCalled()
                })
            })

            describe('when session has no error', () => {
                it("doesn't emit event", () => {
                    const mockSession = new MockMSMediaKeySession()
                    implementEventFakes(mockSession)

                    const msCommonMediaKeySession = new MsCommonMediaKeySession(
                        mockSession,
                        mimeType,
                        initDataType,
                        initData
                    )

                    expect(mockSession.addEventListener).toHaveBeenCalled()

                    const messageEventSpy = createEventSpy(
                        msCommonMediaKeySession,
                        'error'
                    )

                    mockSession.dispatchEvent(mockMsMediaKeyError)
                    expect(messageEventSpy).not.toHaveBeenCalled()
                })
            })
        })

        describe('update', () => {
            it('rejects update when disposed', async () => {
                msCommonMediaKeySession.dispose()
                await expectAsync(
                    msCommonMediaKeySession.update(new ArrayBuffer(0))
                ).toBeRejectedWith(new DisposedError())
            })

            it('updates media key session', async () => {
                const arrayBufferEmpty = new ArrayBuffer(0)
                await msCommonMediaKeySession.update(arrayBufferEmpty)
                expect(mockMsMediaKeySession.update).toHaveBeenCalledOnceWith(
                    new Uint8Array(arrayBufferEmpty)
                )
            })
        })

        describe('dispose', () => {
            it('removes listeners and closes session', () => {
                expect(msCommonMediaKeySession.disposed).toBeFalse()
                msCommonMediaKeySession.dispose()
                expect(msCommonMediaKeySession.disposed).toBeTrue()
                expect(mockMsMediaKeySessionEvents.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
                expect(mockMsMediaKeySession.close).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('msErrorCodeToStr', () => {
        it('translates value correctly', () => {
            expect(
                msErrorCodeToStr(MSMediaKeyError.MS_MEDIA_KEYERR_CLIENT)
            ).toBe(MediaKeySessionErrorType.CLIENT)

            expect(
                msErrorCodeToStr(MSMediaKeyError.MS_MEDIA_KEYERR_DOMAIN)
            ).toBe(MediaKeySessionErrorType.DOMAIN)

            expect(
                msErrorCodeToStr(MSMediaKeyError.MS_MEDIA_KEYERR_HARDWARECHANGE)
            ).toBe(MediaKeySessionErrorType.HARDWARECHANGE)

            expect(
                msErrorCodeToStr(MSMediaKeyError.MS_MEDIA_KEYERR_OUTPUT)
            ).toBe(MediaKeySessionErrorType.OUTPUT)

            expect(
                msErrorCodeToStr(MSMediaKeyError.MS_MEDIA_KEYERR_SERVICE)
            ).toBe(MediaKeySessionErrorType.SERVICE)

            expect(
                msErrorCodeToStr(MSMediaKeyError.MS_MEDIA_KEYERR_UNKNOWN)
            ).toBe(MediaKeySessionErrorType.UNKNOWN)
        })
    })
})
