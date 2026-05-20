/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    DrmKeySystem,
    StandardCommonEme,
    StandardCommonMediaKeys,
    StandardCommonMediaKeySession,
    StandardCommonMediaKeySystemAccess,
} from '@amazon/vinyl'
import {
    Deferred,
    DisposedError,
    never,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { MockNavigator } from '@amazon/vinyl-util/browserTestUtil'
import {
    type EventFakesHandle,
    expectTypeEquals,
    flushPromises,
    implementEventFakes,
    mockEvent,
    MockHTMLAudioElement,
    MockMediaKeyMessageEvent,
    MockMediaKeys,
    MockMediaKeySession,
    MockMediaKeySystemAccess,
} from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy, setMockNavigator } from '@amazon/vinyl-util/testUtil'
import any = jasmine.any

describe('StandardCommonEme', () => {
    let navigator: MockNavigator
    let mediaKeySystemAccess: MockMediaKeySystemAccess

    beforeEach(() => {
        navigator = setMockNavigator()

        mediaKeySystemAccess = new MockMediaKeySystemAccess()
        mediaKeySystemAccess.createMediaKeys.and.resolveTo(new MockMediaKeys())
        navigator.requestMediaKeySystemAccess.and.resolveTo(
            mediaKeySystemAccess
        )
    })

    describe('StandardCommonEme', () => {
        let audio: MockHTMLAudioElement
        let standardCommonEme: StandardCommonEme
        let audioEventFakes: EventFakesHandle

        beforeEach(() => {
            audio = new MockHTMLAudioElement()
            audioEventFakes = implementEventFakes(audio)

            standardCommonEme = new StandardCommonEme()
        })

        describe('requestMediaKeySystemAccess', () => {
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

            describe('when navigator.requestMediaKeySystemAccess resolves', () => {
                it('returns StandardCommonMediaKeySystemAccess', async () => {
                    expect(
                        navigator.requestMediaKeySystemAccess
                    ).not.toHaveBeenCalled()

                    await expectAsync(
                        standardCommonEme.requestMediaKeySystemAccess(
                            DrmKeySystem.WIDEVINE,
                            supportedConfigurations
                        )
                    ).toBeResolvedTo(any(StandardCommonMediaKeySystemAccess))
                })
            })

            describe('when navigator.requestMediaKeySystemAccess rejects', () => {
                beforeEach(() => {
                    navigator.requestMediaKeySystemAccess.and.rejectWith(
                        new Error('expected')
                    )
                })

                it('rejects with reason', async () => {
                    await expectAsync(
                        standardCommonEme.requestMediaKeySystemAccess(
                            DrmKeySystem.WIDEVINE,
                            supportedConfigurations
                        )
                    ).toBeRejectedWithError(Error, 'expected')
                })
            })
        })

        describe('addEncryptedListener', () => {
            it('adds a listener and returns an Unsubscribe handle', () => {
                expect(audioEventFakes.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)

                const handler = jasmine.createSpy('handler')
                const encryptedSub = standardCommonEme.addEncryptedListener(
                    audio,
                    handler
                )
                expect(handler).not.toHaveBeenCalled()

                expectTypeEquals<typeof encryptedSub, Unsubscribe>(true)

                const encryptedEvent = mockEvent('encrypted')
                audio.dispatchEvent(encryptedEvent)
                expect(handler).toHaveBeenCalledOnceWith(encryptedEvent)

                encryptedSub()
                expect(audioEventFakes.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
            })
        })
    })

    describe('StandardCommonMediaKeySystemAccess', () => {
        let standardCommonMediaKeySystemAccess: StandardCommonMediaKeySystemAccess

        beforeEach(() => {
            standardCommonMediaKeySystemAccess =
                new StandardCommonMediaKeySystemAccess(
                    DrmKeySystem.WIDEVINE,
                    mediaKeySystemAccess
                )
        })

        describe('createMediaKeys', () => {
            it('creates media keys', async () => {
                expect(
                    mediaKeySystemAccess.createMediaKeys
                ).not.toHaveBeenCalled()

                const mediaKeys =
                    await standardCommonMediaKeySystemAccess.createMediaKeys()
                expect(
                    mediaKeySystemAccess.createMediaKeys
                ).toHaveBeenCalledTimes(1)

                expect(mediaKeys).toBeInstanceOf(StandardCommonMediaKeys)
            })
        })
    })

    describe('StandardCommonMediaKeys', () => {
        let mockAudioElement: MockHTMLAudioElement
        let mediaKeys: MockMediaKeys
        let standardCommonMediaKeys: StandardCommonMediaKeys

        beforeEach(() => {
            mockAudioElement = new MockHTMLAudioElement()
            mediaKeys = new MockMediaKeys()
            standardCommonMediaKeys = new StandardCommonMediaKeys(
                DrmKeySystem.WIDEVINE,
                mediaKeys
            )
        })

        describe('setOnElement', () => {
            it('sets media keys on element', async () => {
                expect(mockAudioElement.setMediaKeys).not.toHaveBeenCalled()

                await standardCommonMediaKeys.setOnElement(mockAudioElement)
                expect(mockAudioElement.setMediaKeys).toHaveBeenCalledOnceWith(
                    mediaKeys
                )
            })
        })

        describe('clearFromElement', () => {
            it('clears media keys on element', async () => {
                expect(mockAudioElement.setMediaKeys).not.toHaveBeenCalled()

                await standardCommonMediaKeys.clearFromElement(mockAudioElement)
                expect(mockAudioElement.setMediaKeys).toHaveBeenCalledOnceWith(
                    null
                )
            })
        })

        describe('setServerCertificate', () => {
            it('delegates to mediaKeys.setServerCertificate and returns the result', async () => {
                const cert = new Uint8Array([1, 2, 3])
                mediaKeys.setServerCertificate.and.resolveTo(true)
                const result =
                    await standardCommonMediaKeys.setServerCertificate(cert)
                expect(result).toBeTrue()
                expect(mediaKeys.setServerCertificate).toHaveBeenCalledOnceWith(
                    cert
                )
            })
        })

        describe('createSession', () => {
            it('creates a session', () => {
                expect(mediaKeys.createSession).not.toHaveBeenCalled()
                const mediaKeySession = new MockMediaKeySession()
                mediaKeySession.closed = never
                implementEventFakes(mediaKeySession)
                mediaKeySession.generateRequest.and.resolveTo(void 0)
                mediaKeys.createSession.and.returnValue(mediaKeySession)

                const mimeType = 'audio'
                const initData = new Uint8Array([1, 2, 3])
                const session = standardCommonMediaKeys.createSession(
                    mimeType,
                    'cenc',
                    initData
                )
                expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                    'temporary'
                )
                expect(session).toBeInstanceOf(StandardCommonMediaKeySession)
                expect(session.initData).toBe(initData)
                expect(session.mimeType).toBe(mimeType)
                expect(session.initDataType).toBe('cenc')
            })
        })
    })

    describe('StandardCommonMediaKeySession', () => {
        let mediaKeySession: MockMediaKeySession
        let mediaKeySessionEventFakes: EventFakesHandle
        let standardCommonMediaKeySession: StandardCommonMediaKeySession
        const mimeType = 'audio'
        const initData = new Uint8Array([1, 2, 3])
        let closed: Deferred<MediaKeySessionClosedReason>

        beforeEach(() => {
            mediaKeySession = new MockMediaKeySession()
            mediaKeySessionEventFakes = implementEventFakes(mediaKeySession)
            mediaKeySession.close.and.returnValue(Promise.resolve())
            mediaKeySession.generateRequest.and.resolveTo(void 0)
            closed = new Deferred()
            mediaKeySession.closed = closed
            standardCommonMediaKeySession = new StandardCommonMediaKeySession(
                mediaKeySession,
                mimeType,
                'cenc',
                initData
            )
        })

        it('adds event listener on session for message event', () => {
            expect(mediaKeySession.addEventListener).toHaveBeenCalled()

            const messageEventSpy = createEventSpy(
                standardCommonMediaKeySession,
                'message'
            )
            const event = new MockMediaKeyMessageEvent()
            event.type = 'message'
            mediaKeySession.dispatchEvent(event)
            expect(messageEventSpy).toHaveBeenCalledOnceWith({
                message: event.message,
            })
        })

        describe('when created', () => {
            it('calls session.generateRequest() with the initData buffer', () => {
                expect(
                    mediaKeySession.generateRequest
                ).toHaveBeenCalledOnceWith('cenc', initData.buffer)

                mediaKeySession.generateRequest.calls.reset()
                const arrayBuffer = new ArrayBuffer(0)
                standardCommonMediaKeySession =
                    new StandardCommonMediaKeySession(
                        mediaKeySession,
                        mimeType,
                        'cenc',
                        arrayBuffer
                    )
                expect(
                    mediaKeySession.generateRequest
                ).toHaveBeenCalledOnceWith('cenc', arrayBuffer)
            })

            describe('when session.generateRequest rejects', () => {
                it('emits an error event', async () => {
                    mediaKeySession.generateRequest.and.rejectWith(
                        new Error('expected')
                    )
                    standardCommonMediaKeySession =
                        new StandardCommonMediaKeySession(
                            mediaKeySession,
                            mimeType,
                            'cenc',
                            initData
                        )
                    const errorSpy = createEventSpy(
                        standardCommonMediaKeySession,
                        'error'
                    )
                    await expectAsync(errorSpy.next()).toBeResolvedTo({
                        target: standardCommonMediaKeySession,
                        error: new Error('expected'),
                    })
                })
            })
        })

        describe('update', () => {
            it('throws when disposed', () => {
                standardCommonMediaKeySession.dispose()
                expect(() =>
                    standardCommonMediaKeySession.update(new ArrayBuffer(0))
                ).toThrowError(DisposedError)
            })

            it('updates media key session', async () => {
                const arrayBufferEmpty = new ArrayBuffer(0)
                await standardCommonMediaKeySession.update(arrayBufferEmpty)
                expect(mediaKeySession.update).toHaveBeenCalledOnceWith(
                    arrayBufferEmpty
                )
            })
        })

        describe('closed event', () => {
            it('dispatches when the MediaKeySession closed resolves', async () => {
                const closedSpy = createEventSpy(
                    standardCommonMediaKeySession,
                    'closed'
                )
                closed.resolve('closed-by-application')
                await flushPromises()
                expect(closedSpy).toHaveBeenCalledOnceWith({
                    reason: 'closed-by-application',
                })
            })
        })

        describe('when session.closed is nullish', () => {
            it('does not fail to create a session', () => {
                ;(mediaKeySession as any).closed = null
                expect(
                    () =>
                        new StandardCommonMediaKeySession(
                            mediaKeySession,
                            mimeType,
                            'cenc',
                            new ArrayBuffer(0)
                        )
                ).not.toThrow()
            })
        })

        describe('dispose', () => {
            it('removes listeners and closes session', () => {
                expect(standardCommonMediaKeySession.disposed).toBeFalse()
                standardCommonMediaKeySession.dispose()
                expect(standardCommonMediaKeySession.disposed).toBeTrue()
                expect(mediaKeySessionEventFakes.hasAnyListeners())
                    .withContext('hasAnyListeners')
                    .toBe(false)
                expect(mediaKeySession.close).toHaveBeenCalledOnceWith()
            })
        })
    })
})
