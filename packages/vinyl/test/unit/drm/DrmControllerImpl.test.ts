/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    type DrmControllerEventMap,
    DrmControllerImpl,
    type DrmControllerImplDeps,
    DrmError,
    type DrmInitDataType,
    DrmKeySystem,
    DrmRobustness,
    type EncryptedInitData,
    LICENSE_TIMEOUT,
    type LicenseProvider,
    type LicenseServerOptions,
    type MediaFormatMetadata,
    ReportableMediaError,
} from '@amazon/vinyl'
import type { EventSpy } from '@amazon/vinyl-util/testUtil'
import { createEventSpy, useMockLogger } from '@amazon/vinyl-util/testUtil'
import {
    Abort,
    base64ToByteArray,
    bufferToBase64,
    Deferred,
    ErrorLevel,
    ErrorOrigin,
    never,
    nextEventAsPromise,
    ReportableError,
    utf16ToUint16Array,
} from '@amazon/vinyl-util'
import {
    flushPromises,
    implementEventFakes,
    MockHTMLAudioElement,
    MockMediaError,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    MockCommonEme,
    MockCommonMediaKeys,
    MockCommonMediaKeySession,
    MockCommonMediaKeySystemAccess,
} from '@amazon/vinyl/vinylTestUtil'
import Spy = jasmine.Spy
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('DrmControllerImpl', () => {
    const logger = useMockLogger()
    let activeSessions = 0

    function createMockSession(
        mimeType: string,
        initDataType: DrmInitDataType,
        initData: EncryptedInitData
    ) {
        activeSessions++
        const session = new MockCommonMediaKeySession()
        session.mimeType = mimeType
        session.initDataType = initDataType
        session.initData = initData
        session.dispose.and.callFake(() => activeSessions--)
        return session
    }

    let deps: DrmControllerImplDeps
    let media: MockHTMLAudioElement
    let commonEme: MockCommonEme
    let mediaKeys: MockCommonMediaKeys
    let access: MockCommonMediaKeySystemAccess
    let licenseProvider: Spy<LicenseProvider>
    let drmController: DrmControllerImpl
    let errorSpy: EventSpy<DrmControllerEventMap, 'error'>
    const clock = useMockTime()

    const drmInfo = {
        contentProtections: [
            {
                keySystem: DrmKeySystem.WIDEVINE,
            },
            {
                keySystem: DrmKeySystem.PLAY_READY,
            },
        ],
        mimeType: 'audio/mp4',
        contentType: 'audio',
        encryptionScheme: 'cenc',
        initDataType: 'cenc',
    } as const satisfies MediaFormatMetadata

    beforeEach(() => {
        activeSessions = 0
        media = new MockHTMLAudioElement()
        commonEme = new MockCommonEme()
        licenseProvider = createSpy('LicenseProvider')
        implementEventFakes(media)
        mediaKeys = new MockCommonMediaKeys()
        mediaKeys.keySystem = DrmKeySystem.WIDEVINE
        mediaKeys.createSession.and.callFake(createMockSession)
        mediaKeys.clearFromElement.and.resolveTo(void 0)
        access = new MockCommonMediaKeySystemAccess(DrmKeySystem.WIDEVINE)
        access.createMediaKeys.and.resolveTo(mediaKeys)
        access.keySystem = DrmKeySystem.WIDEVINE
        commonEme.requestMediaKeySystemAccess.and.resolveTo(access)

        deps = {
            media,
            commonEme,
        }

        drmController = new DrmControllerImpl(deps, {
            licenseProvider,
        })
        errorSpy = createEventSpy(drmController, 'error')
    })

    afterEach(() => {
        if (!drmController.disposed) drmController.dispose()
        expectNoErrors()
    })

    function expectNoErrors() {
        expect(errorSpy).not.toHaveBeenCalled()
    }

    function expectError(message: string) {
        expect(errorSpy).toHaveBeenCalledTimes(1)
        const error = errorSpy.calls.mostRecent().args[0].error
        expect(error.message).toEqual(message)
        errorSpy.calls.reset()
    }

    async function emitEncrypted(
        initData: EncryptedInitData | null = new Uint8Array(0),
        initDataType: DrmInitDataType = 'cenc'
    ) {
        const encryptedCb =
            commonEme.addEncryptedListener.calls.mostRecent().args[1]
        encryptedCb({
            initData,
            initDataType,
        })
        await flushPromises()
    }

    /**
     * Gets the key session for the given index, in the order for which it was created.
     * @param index
     */
    function getSession(index: number): MockCommonMediaKeySession {
        return mediaKeys.createSession.calls.all()[index]
            .returnValue as MockCommonMediaKeySession
    }

    /**
     * Simulates a message event for the key session at the given index.
     *
     * @param index The key session, indexed in the order it was created.
     * @param message
     */
    async function emitMessage(
        index: number = 0,
        message: ArrayBuffer = new ArrayBuffer(0)
    ): Promise<void> {
        getSession(index).dispatch('message', {
            message,
        })
        await flushPromises()
    }

    /**
     * Returns the key systems requested from commonEme.
     */
    function getKeySystemsRequested(): readonly DrmKeySystem[] {
        return commonEme.requestMediaKeySystemAccess.calls
            .all()
            .map((call) => call.args[0])
    }

    describe('initializeForPlayback', () => {
        describe('when drmInfo has content encryption', () => {
            describe('and commonEme is null', () => {
                it('emits an error event', () => {
                    drmController = new DrmControllerImpl(
                        {
                            ...deps,
                            commonEme: null,
                        },
                        { licenseProvider }
                    )
                    errorSpy = createEventSpy(drmController, 'error')
                    drmController.initializeForPlayback(null)
                    expectNoErrors()
                    drmController.initializeForPlayback(
                        createEmptyMediaQualityMetadata()
                    )
                    expectNoErrors()
                    drmController.initializeForPlayback(drmInfo)
                    expectError('DRM not supported.')
                })
            })
        })

        it('sorts content protections by priority', async () => {
            commonEme.requestMediaKeySystemAccess.and.callFake((keySystem) => {
                return keySystem === DrmKeySystem.WIDEVINE
                    ? Promise.resolve(access)
                    : Promise.reject(new Error('not supported'))
            })
            drmController = new DrmControllerImpl(deps, {
                keySystems: {
                    [DrmKeySystem.WIDEVINE]: {
                        priority: 1, // lowest priority
                    },
                    [DrmKeySystem.PLAY_READY]: {
                        licenseServer: { url: 'https://example.com/playready' },
                        priority: 2,
                    },
                    [DrmKeySystem.PLAY_READY_3000]: {
                        priority: 3,
                    },
                    [DrmKeySystem.FAIR_PLAY]: {
                        priority: 4,
                    },
                    [DrmKeySystem.FAIR_PLAY_1_0]: {
                        // equal priorities will prefer key systems with licenseServer configuration:
                        licenseServer: { url: 'https://example.com/fps' },
                        priority: 4, // highest priority
                    },
                },
                licenseProvider,
            })
            const mediaKeysSetSpy = createEventSpy(
                drmController,
                'mediaKeysSet'
            )
            const sessionCreateSpy = createEventSpy(
                drmController,
                'sessionCreate'
            )
            drmController.initializeForPlayback({
                ...drmInfo,
                contentProtections: [
                    {
                        keySystem: DrmKeySystem.WIDEVINE,
                        pssh: '123',
                    },
                    {
                        keySystem: DrmKeySystem.FAIR_PLAY,
                        pssh: '123',
                    },
                    {
                        keySystem: DrmKeySystem.PLAY_READY,
                        pssh: '123',
                    },
                ],
            })

            await flushPromises()
            expect(mediaKeysSetSpy).toHaveBeenCalledTimes(1)
            expect(sessionCreateSpy).toHaveBeenCalledTimes(1)

            expect(mediaKeys.createSession).toHaveBeenCalledTimes(1)

            expect(getKeySystemsRequested()).toEqual([
                DrmKeySystem.FAIR_PLAY,
                DrmKeySystem.PLAY_READY,
                DrmKeySystem.WIDEVINE,
            ])
        })

        describe('when drmInfo is missing mimeType', () => {
            it('emits an error event', async () => {
                drmController.initializeForPlayback({
                    ...drmInfo,
                    mimeType: null,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.WIDEVINE,
                            pssh: '123',
                        },
                    ],
                })
                await errorSpy.next()
                expectError('Encrypted content must have a mimeType.')
            })
        })

        describe('when drmInfo does not contain the current key system', () => {
            it('throws', async () => {
                drmController.initializeForPlayback({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.WIDEVINE,
                            pssh: '123',
                        },
                    ],
                }) // attaches media keys for Widevine
                await nextEventAsPromise(drmController, 'mediaKeysSet')
                drmController.initializeForPlayback({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.PLAY_READY,
                            pssh: '123',
                        },
                    ],
                })
                await errorSpy.next()
                expectError(
                    `Encrypted content does not support set keySystem: 'com.widevine.alpha'.`
                )
            })
        })

        describe('when drmInfo does not have initDataType', () => {
            it('defaults to cenc', async () => {
                const sessionCreateSpy = createEventSpy(
                    drmController,
                    'sessionCreate'
                )
                drmController.initializeForPlayback({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.WIDEVINE,
                            pssh: '123',
                        },
                    ],
                    initDataType: null,
                })
                const keySessionEvent = await sessionCreateSpy.next()
                expect(keySessionEvent).toEqual({
                    initDataType: 'cenc',
                    mimeType: 'audio/mp4',
                })
            })
        })

        describe('when drmInfo does not have contentType', () => {
            it('creates a session with default configuration', async () => {
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.WIDEVINE]: {
                            licenseServer: { url: 'license-server' },
                        },
                    },
                    licenseProvider,
                })
                const sessionCreateSpy = createEventSpy(
                    drmController,
                    'sessionCreate'
                )
                drmController.initializeForPlayback({
                    ...drmInfo,
                    contentType: null,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.WIDEVINE,
                            pssh: '123',
                        },
                    ],
                })
                await sessionCreateSpy.next()
                expect(
                    commonEme.requestMediaKeySystemAccess
                ).toHaveBeenCalledOnceWith(DrmKeySystem.WIDEVINE, [
                    { initDataTypes: ['cenc'] },
                ])
            })
        })
    })

    describe('setBufferingDrmInfo', () => {
        it('resets error event gate', async () => {
            commonEme.requestMediaKeySystemAccess.and.rejectWith(
                new DrmError('expected')
            )
            await emitEncrypted()
            await emitEncrypted()
            await emitEncrypted() // multiple encrypted events should emit only one error event
            expectError(
                'Encrypted content not configured with content protections.'
            )
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
            await emitEncrypted()
            await emitEncrypted()
            expect(errorSpy).toHaveBeenCalledTimes(1)
            const error = errorSpy.calls.mostRecent().args[0].error as DrmError

            expect(error.toJSON()).toEqual(
                objectContaining({
                    message: 'No keySystem supported',
                    extra: {
                        contentProtections: any(Object),
                        attemptedKeySystems: [
                            DrmKeySystem.WIDEVINE,
                            DrmKeySystem.PLAY_READY,
                        ],
                    },
                })
            )
            errorSpy.calls.reset()
        })

        describe('and the passed abort ref is aborted', () => {
            it('closes sessions created with passed abort ref', async () => {
                const abort1 = new Abort()
                drmController.setBufferingDrmInfo(drmInfo, abort1)
                await emitEncrypted(new Uint8Array([1]))
                await emitEncrypted(new Uint8Array([2]))
                await emitEncrypted(new Uint8Array([3]))

                const abort2 = new Abort()
                drmController.setBufferingDrmInfo(drmInfo, abort2)
                await emitEncrypted(new Uint8Array([4]))
                await emitEncrypted(new Uint8Array([5]))
                await emitEncrypted(new Uint8Array([6]))

                const sessions = mediaKeys.createSession.calls
                    .all()
                    .map(
                        (call) => call.returnValue as MockCommonMediaKeySession
                    )
                expect(sessions.length).withContext('total sessions').toEqual(6)

                abort1.abort()
                expect(
                    sessions.map((session) => session.dispose.calls.count())
                ).toEqual([1, 1, 1, 0, 0, 0]) // Expect first three sessions to have been disposed
                expect(drmController.activeSessions).toEqual(3)

                abort2.abort()
                expect(
                    sessions.map((session) => session.dispose.calls.count())
                ).toEqual([1, 1, 1, 1, 1, 1]) // Expect all sessions to have been disposed
                expect(drmController.activeSessions).toEqual(0)
            })
        })
    })

    describe('when an encrypted event is observed', () => {
        it('throws error if contentProtections are not set', async () => {
            await emitEncrypted()
            expectError(
                'Encrypted content not configured with content protections.'
            )
        })

        describe('and the drm controller is disposed', () => {
            it('does nothing', async () => {
                drmController.dispose()
                await emitEncrypted()
                expect(errorSpy).not.toHaveBeenCalled()
            })
        })

        describe('when media keys have not been created', () => {
            it('creates and sets media keys, then creates a session', async () => {
                const sessionCreatSpy = createEventSpy(
                    drmController,
                    'sessionCreate'
                )
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted()
                expect(
                    commonEme.requestMediaKeySystemAccess
                ).toHaveBeenCalledTimes(1)
                expect(access.createMediaKeys).toHaveBeenCalledTimes(1)
                expect(mediaKeys.setOnElement).toHaveBeenCalledOnceWith(media)
                expect(mediaKeys.createSession).toHaveBeenCalledTimes(1)
                expect(sessionCreatSpy).toHaveBeenCalledOnceWith({
                    mimeType: 'audio/mp4',
                    initDataType: 'cenc',
                })
            })

            it('picks the first supported keySystem', async () => {
                drmController.setBufferingDrmInfo(drmInfo)
                commonEme.requestMediaKeySystemAccess.and.returnValues(
                    Promise.reject(new DrmError('not supported')),
                    Promise.resolve(access)
                )
                await emitEncrypted()
                expect(getKeySystemsRequested()).toEqual([
                    DrmKeySystem.WIDEVINE,
                    DrmKeySystem.PLAY_READY,
                ])
            })

            it('creates key system access from content protection configuration and robustness options for video', async () => {
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.WIDEVINE]: {
                            licenseServer: { url: 'license-server' },
                            video: {
                                robustness: DrmRobustness.HW_SECURE_DECODE,
                            },
                        },
                    },
                    licenseProvider,
                })
                // Note the contentType incongruity is from Dash referring to contentType as video, audio, text
                // while EME refers to contentType as the mimeType.
                drmController.setBufferingDrmInfo({
                    ...drmInfo,
                    contentType: 'video',
                    mimeType: 'video/mp4',
                })
                const initData = new Uint8Array(0)
                await emitEncrypted(initData, 'webm')
                expect(
                    commonEme.requestMediaKeySystemAccess
                ).toHaveBeenCalledOnceWith(DrmKeySystem.WIDEVINE, [
                    {
                        initDataTypes: ['cenc'],
                        videoCapabilities: [
                            {
                                contentType: 'video/mp4',
                                encryptionScheme: 'cenc',
                                robustness: DrmRobustness.HW_SECURE_DECODE,
                            },
                        ],
                    },
                ])
            })

            it('creates key system access from content protection configuration and robustness options for audio', async () => {
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.PLAY_READY]: {
                            licenseServer: { url: 'license-server' },
                            audio: {
                                robustness: DrmRobustness.SW_SECURE_DECODE,
                            },
                        },
                    },
                    licenseProvider,
                })
                drmController.setBufferingDrmInfo({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.PLAY_READY,
                        },
                    ],
                    contentType: 'audio',
                    mimeType: 'audio/mp4',
                })
                const initData = new Uint8Array(0)
                await emitEncrypted(initData, 'cenc')
                expect(
                    commonEme.requestMediaKeySystemAccess
                ).toHaveBeenCalledOnceWith(DrmKeySystem.PLAY_READY, [
                    {
                        initDataTypes: ['cenc'],
                        audioCapabilities: [
                            {
                                contentType: 'audio/mp4',
                                encryptionScheme: 'cenc',
                                robustness: DrmRobustness.SW_SECURE_DECODE,
                            },
                        ],
                    },
                ])
            })

            it('uses SW_SECURE_CRYPTO as default robustness', async () => {
                drmController.setBufferingDrmInfo({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.WIDEVINE,
                        },
                    ],
                    contentType: 'audio',
                    mimeType: 'audio/mp4',
                })
                await emitEncrypted()
                expect(
                    commonEme.requestMediaKeySystemAccess
                ).toHaveBeenCalledOnceWith(DrmKeySystem.WIDEVINE, [
                    {
                        initDataTypes: ['cenc'],
                        audioCapabilities: [
                            {
                                contentType: 'audio/mp4',
                                encryptionScheme: 'cenc',
                            },
                        ],
                    },
                ])
            })

            describe('when media key initialization fails', () => {
                describe('and the error is silent', () => {
                    beforeEach(() => {
                        access.createMediaKeys.and.rejectWith(
                            new ReportableError(
                                '',
                                ErrorOrigin.INTERNAL,
                                ErrorLevel.SILENT
                            )
                        )
                    })

                    it('does not emit an error event', async () => {
                        drmController.setBufferingDrmInfo(drmInfo)
                        await emitEncrypted()
                        expect(errorSpy).not.toHaveBeenCalled()
                    })
                })

                describe('and the error is not silent', () => {
                    beforeEach(() => {
                        access.createMediaKeys.and.rejectWith(new Error())
                    })

                    it('emits an error event', async () => {
                        drmController.setBufferingDrmInfo(drmInfo)
                        await emitEncrypted()
                        expect(errorSpy).toHaveBeenCalledTimes(1)
                        errorSpy.calls.reset()
                    })
                })
            })

            describe('when drmController is disposed', () => {
                it('does not create a session', async () => {
                    const licenseServerDeferred =
                        new Deferred<LicenseServerOptions>()
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.WIDEVINE]: {
                                licenseServer: () => licenseServerDeferred,
                            },
                        },
                    })
                    drmController.setBufferingDrmInfo(drmInfo)
                    await emitEncrypted()
                    expect(drmController.activeSessions).toBe(0)
                    drmController.dispose()
                    licenseServerDeferred.resolve({
                        serverCertificate: 'cert',
                    })
                    await flushPromises()
                    expect(drmController.activeSessions).toBe(0)
                })
            })
        })

        describe('when initData is nullish', () => {
            it('emits an error event', async () => {
                logger.value.debug.calls.reset()
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted(null)
                expectError(
                    'encrypted event provided null initData. Check CORS policies.'
                )
                expect(mediaKeys.createSession).not.toHaveBeenCalled()
            })
        })

        it('reuses sessions with matching initialization data', async () => {
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted(new Uint8Array([1, 2, 3]))
            expect(mediaKeys.createSession).toHaveBeenCalledTimes(1)
            mediaKeys.createSession.calls.reset()
            await emitEncrypted(new Uint8Array([1, 2, 3]))
            expect(mediaKeys.createSession).not.toHaveBeenCalled()
            await emitEncrypted(new Uint8Array([4, 5, 6]))
            expect(mediaKeys.createSession).toHaveBeenCalledTimes(1)
        })
    })

    describe('when a session error event is observed', () => {
        it('redispatches the event when first', async () => {
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
            const session = getSession(0)
            expect(errorSpy).not.toHaveBeenCalled()
            session.dispatch('error', {
                target: drmController,
                error: new Error('expected'),
            })
            expect(errorSpy).toHaveBeenCalledOnceWith({
                target: drmController,
                error: new Error('expected'),
            })
            errorSpy.calls.reset()
            session.dispatch('error', {
                target: drmController,
                error: new Error('expected'),
            })
            expect(errorSpy).not.toHaveBeenCalled()
            drmController.setBufferingDrmInfo(drmInfo)
            session.dispatch('error', {
                target: drmController,
                error: new Error('expected2'),
            })
            expect(errorSpy).toHaveBeenCalledOnceWith({
                target: drmController,
                error: new Error('expected2'),
            })
            errorSpy.calls.reset()
        })
    })

    describe('when a session message event is observed', () => {
        it('calls the licenseProvider with resolved licenseServer options', async () => {
            drmController = new DrmControllerImpl(deps, {
                keySystems: {
                    // Configure with the different valid licenseServer configurations
                    [DrmKeySystem.WIDEVINE]: {
                        licenseServer: () => {
                            return Promise.resolve({
                                url: 'http://example.com/widevine',
                            })
                        },
                    },
                    [DrmKeySystem.PLAY_READY]: {
                        licenseServer: () => ({
                            url: 'http://example.com/playready',
                        }),
                    },
                    [DrmKeySystem.FAIR_PLAY]: {
                        licenseServer: {
                            url: 'http://example.com/fairplay',
                        },
                    },
                },
                licenseProvider,
            })

            drmController.setBufferingDrmInfo(drmInfo)

            await emitEncrypted(new Uint8Array([1, 2, 3]), 'cenc')
            const message = new ArrayBuffer(1)
            {
                await emitMessage(0, message)
                expect(licenseProvider).toHaveBeenCalledOnceWith(
                    DrmKeySystem.WIDEVINE,
                    {
                        url: 'http://example.com/widevine',
                    },
                    message
                )
            }
            {
                licenseProvider.calls.reset()
                mediaKeys.keySystem = DrmKeySystem.PLAY_READY
                await emitMessage(0, message)
                expect(licenseProvider).toHaveBeenCalledOnceWith(
                    DrmKeySystem.PLAY_READY,
                    {
                        url: 'http://example.com/playready',
                        init: {
                            headers: any(Object),
                        },
                    },
                    message
                )
            }
            {
                licenseProvider.calls.reset()
                mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY
                await emitMessage(0, message)
                expect(licenseProvider).toHaveBeenCalledOnceWith(
                    DrmKeySystem.FAIR_PLAY,
                    {
                        url: 'http://example.com/fairplay',
                    },
                    message
                )
            }
        })

        describe('when license takes too long to resolve', () => {
            it('emits an error event', async () => {
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.WIDEVINE]: {
                            licenseServer: {
                                url: 'http://example.com/widevine',
                            },
                        },
                    },
                    licenseProvider: () => never,
                })
                errorSpy = createEventSpy(drmController, 'error')
                drmController.setBufferingDrmInfo(drmInfo)

                await emitEncrypted(new Uint8Array([1, 2, 3]), 'cenc')
                const message = new ArrayBuffer(1)
                await emitMessage(0, message)
                await clock.tick(LICENSE_TIMEOUT)
                expectError('License provider timed out after 90s')
            })
        })

        describe('when the key system is PlayReady', () => {
            it('calls the licenseProvider with unpacked license server options', async () => {
                function setPlayReady() {
                    drmController.setBufferingDrmInfo({
                        ...drmInfo,
                        contentProtections: [
                            {
                                keySystem: DrmKeySystem.PLAY_READY,
                            },
                        ],
                    })
                    mediaKeys.keySystem = DrmKeySystem.PLAY_READY
                }
                {
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.PLAY_READY]: {
                                licenseServer: () => ({
                                    url: 'http://example.com/playready',
                                    init: {
                                        headers: [['HeaderA', 'ValueA']],
                                    },
                                }),
                            },
                        },
                        licenseProvider,
                    })

                    const message = new ArrayBuffer(1)
                    setPlayReady()
                    await emitEncrypted()
                    await emitMessage(0, message)
                    expect(licenseProvider).toHaveBeenCalledOnceWith(
                        DrmKeySystem.PLAY_READY,
                        {
                            url: 'http://example.com/playready',
                            init: {
                                headers: {
                                    HeaderA: 'ValueA',
                                    'Content-Type': 'text/xml; charset=utf-8',
                                },
                            },
                        },
                        message
                    )
                }
                {
                    licenseProvider.calls.reset()
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.PLAY_READY]: {
                                licenseServer: () => ({
                                    url: 'http://example.com/playready',
                                }),
                            },
                        },
                        licenseProvider,
                    })
                    const challenge = new Uint8Array([1, 2, 3, 4, 5, 6]).buffer
                    // language=XML
                    const xml = `<PlayReadyKeyMessage type="LicenseAcquisition">
       <LicenseAcquisition Version="1">
         <Challenge encoding="base64encoded">${bufferToBase64(challenge)}</Challenge>
         <HttpHeaders>
           <HttpHeader>
             <name>HeaderA</name>
             <value>ValueA</value>
           </HttpHeader>
           <HttpHeader>
             <name>HeaderB</name>
             <value>ValueB</value>
           </HttpHeader>
         </HttpHeaders>
       </LicenseAcquisition>
     </PlayReadyKeyMessage>`
                    const message = utf16ToUint16Array(xml)
                    setPlayReady()
                    await emitEncrypted()
                    await emitMessage(0, message.buffer)
                    expect(licenseProvider).toHaveBeenCalledOnceWith(
                        DrmKeySystem.PLAY_READY,
                        {
                            url: 'http://example.com/playready',
                            init: {
                                headers: {
                                    HeaderA: 'ValueA',
                                    HeaderB: 'ValueB',
                                },
                            },
                        },
                        challenge
                    )
                }
            })
        })

        it('updates the respective session with the license response', async () => {
            drmController.setBufferingDrmInfo(drmInfo)

            await emitEncrypted(new Uint8Array([1, 2, 3]), 'cenc') // Create a session
            await emitEncrypted(new Uint8Array([4, 5, 6]), 'cenc') // Creates another session
            await emitEncrypted(new Uint8Array([4, 5, 6]), 'cenc') // Re-uses same session
            expect(activeSessions).toBe(2)
            expect(drmController.activeSessions).toBe(2)

            const message1 = new ArrayBuffer(1)
            const message2 = new ArrayBuffer(2)
            const licenseResponsePromise1 = new Deferred<ArrayBuffer>()
            const licenseResponsePromise2 = new Deferred<ArrayBuffer>()
            licenseProvider.and.returnValues(
                licenseResponsePromise1,
                licenseResponsePromise2
            )

            await emitMessage(0, message1)

            expect(licenseProvider).toHaveBeenCalledOnceWith(
                DrmKeySystem.WIDEVINE,
                {},
                message1
            )

            licenseProvider.calls.reset()
            await emitMessage(1, message2)

            expect(licenseProvider).toHaveBeenCalledOnceWith(
                DrmKeySystem.WIDEVINE,
                {},
                message2
            )

            const licenseResponse1 = new Uint8Array(1)
            const licenseResponse2 = new Uint8Array(2)
            licenseResponsePromise1.resolve(licenseResponse1.buffer)
            licenseResponsePromise2.resolve(licenseResponse2.buffer)

            await flushPromises()

            expect(getSession(0).update).toHaveBeenCalledOnceWith(
                licenseResponse1.buffer
            )
            expect(getSession(1).update).toHaveBeenCalledOnceWith(
                licenseResponse2.buffer
            )
        })

        describe('when the session is closed', () => {
            it('removes the closed session', async () => {
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted(new Uint8Array([1, 2, 3]), 'cenc')
                const sessionCloseSpy = createEventSpy(
                    drmController,
                    'sessionClose'
                )
                expect(drmController.activeSessions).toBe(1)
                getSession(0).dispatch('closed', {
                    reason: 'closed-by-application',
                })
                await flushPromises()
                expect(drmController.activeSessions).toBe(0)
                expect(sessionCloseSpy).toHaveBeenCalledTimes(1)
            })
        })

        describe('when the session is disposed', () => {
            it('does not update the closed session', async () => {
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted(new Uint8Array(0), 'cenc')
                const licenseResponsePromise = new Deferred<ArrayBuffer>()
                licenseProvider.and.returnValue(licenseResponsePromise)

                const session = getSession(0)
                await emitMessage()

                session.disposed = true
                licenseResponsePromise.resolve(new Uint8Array(1).buffer)
                await licenseResponsePromise
                expect(session.update).not.toHaveBeenCalled()
            })
        })

        describe('when the license provider rejects', () => {
            it('emits an error event', async () => {
                const initData = new Uint8Array(0)
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted(initData, 'cenc')

                const error = new Error('expected license error')
                licenseProvider.and.rejectWith(error)

                expect(errorSpy).not.toHaveBeenCalled()
                await emitMessage()
                expectError('expected license error')
            })
        })

        describe('when message is not an ArrayBuffer', () => {
            it('emits an error event', async () => {
                drmController.setBufferingDrmInfo(drmInfo)

                const initData = new Uint8Array(0)
                await emitEncrypted(initData, 'cenc')

                await emitMessage(
                    0,
                    // @ts-expect-error Expected ArrayBuffer
                    null
                )
                expectError(
                    'Expected: instance of ArrayBuffer, but was: null. At: message'
                )
            })
        })
    })

    describe('serverCertificate', () => {
        describe('when keySystem is FAIR_PLAY_1_0', () => {
            it('initializes sessions using createFairPlaySessionInitData', async () => {
                // These data were extracted from a catalog track, asin://B0B5HKZZ98.
                const initData = base64ToByteArray(
                    'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAA=='
                )
                const certBase64 =
                    'MIIE1TCCA72gAwIBAgIIFW3qWt9NdaQwDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwODI3MTcwMjI3WhcNMTYwODI3MTcwMjI3WjBuMQswCQYDVQQGEwJVUzETMBEGA1UECgwKQW1hem9uLmNvbTEWMBQGA1UECwwNRGlnaXRhbCBWaWRlbzEyMDAGA1UEAwwpRlBTIGZvciBBbWF6b24gSW5zdGFudCBWaWRlbyBhcHBsaWNhdGlvbnMwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAKTLDDVOTIYAGQO0nwblswQ3jjz4sc9tD7dYdxTgaAekFadAJdcsiOwCtudDLunhE3q4uNMQtAh4UExvzL9pUxhnzyeuAmHOTI8vUCCcVD2mt03w98EUFXpUU82s5EauWX8rrUI07FCdWdnD3ylj/eIVdbbQhKcvkvoipiCO4fedAgMBAAGjggHoMIIB5DAdBgNVHQ4EFgQUW+PdiCeqmpoNPwdJIng5MA465MYwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMA4GA1UdDwEB/wQEAwIFIDAuBgsqhkiG92NkBg0BAwEB/wQcAXA1O2DFgVbri+9ptKoYMZ/p8CQpC6dMjuxHqzA4BgsqhkiG92NkBg0BBAEB/wQmASf94c8MkzPOIrjZGeyjlFaiDcQlWfRzqMe/ZMSbmtmEEWv/xP4wDQYJKoZIhvcNAQEFBQADggEBAIKRz+hZDC2v99OCaqJY/6+L1EUJscv2hP6MC5yKSte0rkwuJUYIFbzBUlmyq39Osli5ma+5afrCgTy0Rtw3QVPeZDI47zWfBVNQrgwh+eQ9Gg1pGM6V5MXP4SVsC6MkuygPfQr4fz0WDewfBBU6V13LZr7Y0jZ2AMmrit5W+i11uvL/6oKtA6AYsdX/MWt+IgBkt2prRwxf2S2w0rp41Azzg1a7lXeTqJ5uI22NkjmsjLw0PjnjOKyc0FR96iHW2VbCa+ev1fejVcCJolgVEPd/rZNrRomKvfkEjy1hbVtoxc2W9ndvLt7fU6I5MRCFIWGEHQfK5iYyZLuaX5CmGxg='
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.FAIR_PLAY_1_0]: {
                            licenseServer: {
                                serverCertificate: certBase64,
                            },
                        },
                    },
                    licenseProvider,
                })
                drmController.setBufferingDrmInfo({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.FAIR_PLAY,
                        },
                    ],
                })
                mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY_1_0
                await emitEncrypted(initData, 'cenc')

                const expected =
                    'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAEgAAAAwAGIANQA2ADgAOQBiAGIALQA0ADEANwAxAC0AOQA3AGUANQAtAGMAMgA4ADAALQA5ADkAZgA3AGEAYgBlADQAMAAwADQAZgDZBAAAMIIE1TCCA72gAwIBAgIIFW3qWt9NdaQwDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwODI3MTcwMjI3WhcNMTYwODI3MTcwMjI3WjBuMQswCQYDVQQGEwJVUzETMBEGA1UECgwKQW1hem9uLmNvbTEWMBQGA1UECwwNRGlnaXRhbCBWaWRlbzEyMDAGA1UEAwwpRlBTIGZvciBBbWF6b24gSW5zdGFudCBWaWRlbyBhcHBsaWNhdGlvbnMwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAKTLDDVOTIYAGQO0nwblswQ3jjz4sc9tD7dYdxTgaAekFadAJdcsiOwCtudDLunhE3q4uNMQtAh4UExvzL9pUxhnzyeuAmHOTI8vUCCcVD2mt03w98EUFXpUU82s5EauWX8rrUI07FCdWdnD3ylj/eIVdbbQhKcvkvoipiCO4fedAgMBAAGjggHoMIIB5DAdBgNVHQ4EFgQUW+PdiCeqmpoNPwdJIng5MA465MYwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMA4GA1UdDwEB/wQEAwIFIDAuBgsqhkiG92NkBg0BAwEB/wQcAXA1O2DFgVbri+9ptKoYMZ/p8CQpC6dMjuxHqzA4BgsqhkiG92NkBg0BBAEB/wQmASf94c8MkzPOIrjZGeyjlFaiDcQlWfRzqMe/ZMSbmtmEEWv/xP4wDQYJKoZIhvcNAQEFBQADggEBAIKRz+hZDC2v99OCaqJY/6+L1EUJscv2hP6MC5yKSte0rkwuJUYIFbzBUlmyq39Osli5ma+5afrCgTy0Rtw3QVPeZDI47zWfBVNQrgwh+eQ9Gg1pGM6V5MXP4SVsC6MkuygPfQr4fz0WDewfBBU6V13LZr7Y0jZ2AMmrit5W+i11uvL/6oKtA6AYsdX/MWt+IgBkt2prRwxf2S2w0rp41Azzg1a7lXeTqJ5uI22NkjmsjLw0PjnjOKyc0FR96iHW2VbCa+ev1fejVcCJolgVEPd/rZNrRomKvfkEjy1hbVtoxc2W9ndvLt7fU6I5MRCFIWGEHQfK5iYyZLuaX5CmGxg='
                expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                    drmInfo.mimeType,
                    'cenc',
                    base64ToByteArray(expected)
                )
            })

            it('accepts ArrayBuffer serverCertificate', async () => {
                const initData = base64ToByteArray(
                    'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAA=='
                )
                const certBase64 =
                    'MIIE1TCCA72gAwIBAgIIFW3qWt9NdaQwDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwODI3MTcwMjI3WhcNMTYwODI3MTcwMjI3WjBuMQswCQYDVQQGEwJVUzETMBEGA1UECgwKQW1hem9uLmNvbTEWMBQGA1UECwwNRGlnaXRhbCBWaWRlbzEyMDAGA1UEAwwpRlBTIGZvciBBbWF6b24gSW5zdGFudCBWaWRlbyBhcHBsaWNhdGlvbnMwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAKTLDDVOTIYAGQO0nwblswQ3jjz4sc9tD7dYdxTgaAekFadAJdcsiOwCtudDLunhE3q4uNMQtAh4UExvzL9pUxhnzyeuAmHOTI8vUCCcVD2mt03w98EUFXpUU82s5EauWX8rrUI07FCdWdnD3ylj/eIVdbbQhKcvkvoipiCO4fedAgMBAAGjggHoMIIB5DAdBgNVHQ4EFgQUW+PdiCeqmpoNPwdJIng5MA465MYwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMA4GA1UdDwEB/wQEAwIFIDAuBgsqhkiG92NkBg0BAwEB/wQcAXA1O2DFgVbri+9ptKoYMZ/p8CQpC6dMjuxHqzA4BgsqhkiG92NkBg0BBAEB/wQmASf94c8MkzPOIrjZGeyjlFaiDcQlWfRzqMe/ZMSbmtmEEWv/xP4wDQYJKoZIhvcNAQEFBQADggEBAIKRz+hZDC2v99OCaqJY/6+L1EUJscv2hP6MC5yKSte0rkwuJUYIFbzBUlmyq39Osli5ma+5afrCgTy0Rtw3QVPeZDI47zWfBVNQrgwh+eQ9Gg1pGM6V5MXP4SVsC6MkuygPfQr4fz0WDewfBBU6V13LZr7Y0jZ2AMmrit5W+i11uvL/6oKtA6AYsdX/MWt+IgBkt2prRwxf2S2w0rp41Azzg1a7lXeTqJ5uI22NkjmsjLw0PjnjOKyc0FR96iHW2VbCa+ev1fejVcCJolgVEPd/rZNrRomKvfkEjy1hbVtoxc2W9ndvLt7fU6I5MRCFIWGEHQfK5iYyZLuaX5CmGxg='
                const certBuffer = base64ToByteArray(certBase64)
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.FAIR_PLAY_1_0]: {
                            licenseServer: {
                                serverCertificate: certBuffer.buffer,
                            },
                        },
                    },
                    licenseProvider,
                })
                drmController.setBufferingDrmInfo({
                    ...drmInfo,
                    contentProtections: [
                        {
                            keySystem: DrmKeySystem.FAIR_PLAY,
                        },
                    ],
                })
                mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY_1_0
                await emitEncrypted(initData, 'cenc')

                // Same expected result as the base64 string test
                const expected =
                    'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAEgAAAAwAGIANQA2ADgAOQBiAGIALQA0ADEANwAxAC0AOQA3AGUANQAtAGMAMgA4ADAALQA5ADkAZgA3AGEAYgBlADQAMAAwADQAZgDZBAAAMIIE1TCCA72gAwIBAgIIFW3qWt9NdaQwDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwODI3MTcwMjI3WhcNMTYwODI3MTcwMjI3WjBuMQswCQYDVQQGEwJVUzETMBEGA1UECgwKQW1hem9uLmNvbTEWMBQGA1UECwwNRGlnaXRhbCBWaWRlbzEyMDAGA1UEAwwpRlBTIGZvciBBbWF6b24gSW5zdGFudCBWaWRlbyBhcHBsaWNhdGlvbnMwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAKTLDDVOTIYAGQO0nwblswQ3jjz4sc9tD7dYdxTgaAekFadAJdcsiOwCtudDLunhE3q4uNMQtAh4UExvzL9pUxhnzyeuAmHOTI8vUCCcVD2mt03w98EUFXpUU82s5EauWX8rrUI07FCdWdnD3ylj/eIVdbbQhKcvkvoipiCO4fedAgMBAAGjggHoMIIB5DAdBgNVHQ4EFgQUW+PdiCeqmpoNPwdJIng5MA465MYwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMA4GA1UdDwEB/wQEAwIFIDAuBgsqhkiG92NkBg0BAwEB/wQcAXA1O2DFgVbri+9ptKoYMZ/p8CQpC6dMjuxHqzA4BgsqhkiG92NkBg0BBAEB/wQmASf94c8MkzPOIrjZGeyjlFaiDcQlWfRzqMe/ZMSbmtmEEWv/xP4wDQYJKoZIhvcNAQEFBQADggEBAIKRz+hZDC2v99OCaqJY/6+L1EUJscv2hP6MC5yKSte0rkwuJUYIFbzBUlmyq39Osli5ma+5afrCgTy0Rtw3QVPeZDI47zWfBVNQrgwh+eQ9Gg1pGM6V5MXP4SVsC6MkuygPfQr4fz0WDewfBBU6V13LZr7Y0jZ2AMmrit5W+i11uvL/6oKtA6AYsdX/MWt+IgBkt2prRwxf2S2w0rp41Azzg1a7lXeTqJ5uI22NkjmsjLw0PjnjOKyc0FR96iHW2VbCa+ev1fejVcCJolgVEPd/rZNrRomKvfkEjy1hbVtoxc2W9ndvLt7fU6I5MRCFIWGEHQfK5iYyZLuaX5CmGxg='
                expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                    drmInfo.mimeType,
                    'cenc',
                    base64ToByteArray(expected)
                )
            })

            describe('and certificate data was not configured', () => {
                it('emits an error event', async () => {
                    const initData = new Uint8Array(0)
                    drmController.setBufferingDrmInfo({
                        ...drmInfo,
                        contentProtections: [
                            {
                                keySystem: DrmKeySystem.FAIR_PLAY,
                            },
                        ],
                    })
                    mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY_1_0
                    await emitEncrypted(initData, 'cenc')
                    expectError('FairPlay requires certificate data')
                })
            })

            describe('with initDataTransformer', () => {
                it('uses custom transform instead of default', async () => {
                    const initData = base64ToByteArray(
                        'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAA=='
                    )
                    const certBase64 = 'AQID'
                    const customResult = new Uint8Array([9, 9, 9])
                    const transform = createSpy(
                        'initDataTransformer'
                    ).and.returnValue(customResult)
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.FAIR_PLAY_1_0]: {
                                licenseServer: {
                                    serverCertificate: certBase64,
                                },
                                initDataTransformer: transform,
                            },
                        },
                        licenseProvider,
                    })
                    drmController.setBufferingDrmInfo({
                        ...drmInfo,
                        contentProtections: [
                            {
                                keySystem: DrmKeySystem.FAIR_PLAY,
                            },
                        ],
                    })
                    mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY_1_0
                    await emitEncrypted(initData, 'cenc')

                    expect(transform).toHaveBeenCalledOnceWith(
                        any(Uint8Array),
                        'cenc',
                        objectContaining({ mimeType: drmInfo.mimeType })
                    )
                    expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                        drmInfo.mimeType,
                        'cenc',
                        customResult
                    )
                })

                it('uses custom transform with BufferSource certificate', async () => {
                    const initData = base64ToByteArray(
                        'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAA=='
                    )
                    const certBuffer = new Uint8Array([1, 2, 3])
                    const customResult = new Uint8Array([9, 9, 9])
                    const transform = createSpy(
                        'initDataTransformer'
                    ).and.returnValue(customResult)
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.FAIR_PLAY_1_0]: {
                                licenseServer: {
                                    serverCertificate: certBuffer.buffer,
                                },
                                initDataTransformer: transform,
                            },
                        },
                        licenseProvider,
                    })
                    drmController.setBufferingDrmInfo({
                        ...drmInfo,
                        contentProtections: [
                            {
                                keySystem: DrmKeySystem.FAIR_PLAY,
                            },
                        ],
                    })
                    mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY_1_0
                    await emitEncrypted(initData, 'cenc')

                    expect(transform).toHaveBeenCalledOnceWith(
                        any(Uint8Array),
                        'cenc',
                        objectContaining({ mimeType: drmInfo.mimeType })
                    )
                    expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                        drmInfo.mimeType,
                        'cenc',
                        customResult
                    )
                })

                it('uses custom transform with non-FairPlay key system', async () => {
                    const initData = new Uint8Array(16)
                    const customResult = new Uint8Array([7, 7, 7])
                    const transform = createSpy(
                        'initDataTransformer'
                    ).and.returnValue(customResult)
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.WIDEVINE]: {
                                licenseServer: {},
                                initDataTransformer: transform,
                            },
                        },
                        licenseProvider,
                    })
                    drmController.setBufferingDrmInfo(drmInfo)
                    await emitEncrypted(initData)

                    expect(transform).toHaveBeenCalledOnceWith(
                        any(Uint8Array),
                        'cenc',
                        objectContaining({ mimeType: drmInfo.mimeType })
                    )
                    expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                        drmInfo.mimeType,
                        'cenc',
                        customResult
                    )
                })

                it('uses default createFairPlaySessionInitData when initDataTransformer is not set', async () => {
                    const initData = base64ToByteArray(
                        'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAA=='
                    )
                    const certBase64 =
                        'MIIE1TCCA72gAwIBAgIIFW3qWt9NdaQwDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwODI3MTcwMjI3WhcNMTYwODI3MTcwMjI3WjBuMQswCQYDVQQGEwJVUzETMBEGA1UECgwKQW1hem9uLmNvbTEWMBQGA1UECwwNRGlnaXRhbCBWaWRlbzEyMDAGA1UEAwwpRlBTIGZvciBBbWF6b24gSW5zdGFudCBWaWRlbyBhcHBsaWNhdGlvbnMwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAKTLDDVOTIYAGQO0nwblswQ3jjz4sc9tD7dYdxTgaAekFadAJdcsiOwCtudDLunhE3q4uNMQtAh4UExvzL9pUxhnzyeuAmHOTI8vUCCcVD2mt03w98EUFXpUU82s5EauWX8rrUI07FCdWdnD3ylj/eIVdbbQhKcvkvoipiCO4fedAgMBAAGjggHoMIIB5DAdBgNVHQ4EFgQUW+PdiCeqmpoNPwdJIng5MA465MYwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMA4GA1UdDwEB/wQEAwIFIDAuBgsqhkiG92NkBg0BAwEB/wQcAXA1O2DFgVbri+9ptKoYMZ/p8CQpC6dMjuxHqzA4BgsqhkiG92NkBg0BBAEB/wQmASf94c8MkzPOIrjZGeyjlFaiDcQlWfRzqMe/ZMSbmtmEEWv/xP4wDQYJKoZIhvcNAQEFBQADggEBAIKRz+hZDC2v99OCaqJY/6+L1EUJscv2hP6MC5yKSte0rkwuJUYIFbzBUlmyq39Osli5ma+5afrCgTy0Rtw3QVPeZDI47zWfBVNQrgwh+eQ9Gg1pGM6V5MXP4SVsC6MkuygPfQr4fz0WDewfBBU6V13LZr7Y0jZ2AMmrit5W+i11uvL/6oKtA6AYsdX/MWt+IgBkt2prRwxf2S2w0rp41Azzg1a7lXeTqJ5uI22NkjmsjLw0PjnjOKyc0FR96iHW2VbCa+ev1fejVcCJolgVEPd/rZNrRomKvfkEjy1hbVtoxc2W9ndvLt7fU6I5MRCFIWGEHQfK5iYyZLuaX5CmGxg='
                    drmController = new DrmControllerImpl(deps, {
                        keySystems: {
                            [DrmKeySystem.FAIR_PLAY_1_0]: {
                                licenseServer: {
                                    serverCertificate: certBase64,
                                },
                            },
                        },
                        licenseProvider,
                    })
                    drmController.setBufferingDrmInfo({
                        ...drmInfo,
                        contentProtections: [
                            {
                                keySystem: DrmKeySystem.FAIR_PLAY,
                            },
                        ],
                    })
                    mediaKeys.keySystem = DrmKeySystem.FAIR_PLAY_1_0
                    await emitEncrypted(initData, 'cenc')

                    // Without transform, the existing expected output (UUID-only contentId) is used
                    const expected =
                        'VAAAAHMAawBkADoALwAvADAAYgA1ADYAOAA5AGIAYgAtADQAMQA3ADEALQA5ADcAZQA1AC0AYwAyADgAMAAtADkAOQBmADcAYQBiAGUANAAwADAANABmAEgAAAAwAGIANQA2ADgAOQBiAGIALQA0ADEANwAxAC0AOQA3AGUANQAtAGMAMgA4ADAALQA5ADkAZgA3AGEAYgBlADQAMAAwADQAZgDZBAAAMIIE1TCCA72gAwIBAgIIFW3qWt9NdaQwDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwODI3MTcwMjI3WhcNMTYwODI3MTcwMjI3WjBuMQswCQYDVQQGEwJVUzETMBEGA1UECgwKQW1hem9uLmNvbTEWMBQGA1UECwwNRGlnaXRhbCBWaWRlbzEyMDAGA1UEAwwpRlBTIGZvciBBbWF6b24gSW5zdGFudCBWaWRlbyBhcHBsaWNhdGlvbnMwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAKTLDDVOTIYAGQO0nwblswQ3jjz4sc9tD7dYdxTgaAekFadAJdcsiOwCtudDLunhE3q4uNMQtAh4UExvzL9pUxhnzyeuAmHOTI8vUCCcVD2mt03w98EUFXpUU82s5EauWX8rrUI07FCdWdnD3ylj/eIVdbbQhKcvkvoipiCO4fedAgMBAAGjggHoMIIB5DAdBgNVHQ4EFgQUW+PdiCeqmpoNPwdJIng5MA465MYwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMA4GA1UdDwEB/wQEAwIFIDAuBgsqhkiG92NkBg0BAwEB/wQcAXA1O2DFgVbri+9ptKoYMZ/p8CQpC6dMjuxHqzA4BgsqhkiG92NkBg0BBAEB/wQmASf94c8MkzPOIrjZGeyjlFaiDcQlWfRzqMe/ZMSbmtmEEWv/xP4wDQYJKoZIhvcNAQEFBQADggEBAIKRz+hZDC2v99OCaqJY/6+L1EUJscv2hP6MC5yKSte0rkwuJUYIFbzBUlmyq39Osli5ma+5afrCgTy0Rtw3QVPeZDI47zWfBVNQrgwh+eQ9Gg1pGM6V5MXP4SVsC6MkuygPfQr4fz0WDewfBBU6V13LZr7Y0jZ2AMmrit5W+i11uvL/6oKtA6AYsdX/MWt+IgBkt2prRwxf2S2w0rp41Azzg1a7lXeTqJ5uI22NkjmsjLw0PjnjOKyc0FR96iHW2VbCa+ev1fejVcCJolgVEPd/rZNrRomKvfkEjy1hbVtoxc2W9ndvLt7fU6I5MRCFIWGEHQfK5iYyZLuaX5CmGxg='
                    expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                        drmInfo.mimeType,
                        'cenc',
                        base64ToByteArray(expected)
                    )
                })
            })
        })

        describe('when keySystem is not FAIR_PLAY_1_0', () => {
            it('sets the server certificate on media keys from base64 string', async () => {
                const initData = new Uint8Array(16)
                const certBase64 = 'AQID' // base64 for [1, 2, 3]
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.WIDEVINE]: {
                            licenseServer: {
                                serverCertificate: certBase64,
                            },
                        },
                    },
                    licenseProvider,
                })
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted(initData)
                expect(mediaKeys.setServerCertificate).toHaveBeenCalledOnceWith(
                    base64ToByteArray(certBase64)
                )
                expect(mediaKeys.createSession).toHaveBeenCalledOnceWith(
                    drmInfo.mimeType,
                    'cenc',
                    initData
                )
            })

            it('sets the server certificate on media keys from ArrayBuffer', async () => {
                const initData = new Uint8Array(16)
                const certBuffer = new Uint8Array([1, 2, 3]).buffer
                drmController = new DrmControllerImpl(deps, {
                    keySystems: {
                        [DrmKeySystem.WIDEVINE]: {
                            licenseServer: {
                                serverCertificate: certBuffer,
                            },
                        },
                    },
                    licenseProvider,
                })
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted(initData)
                expect(mediaKeys.setServerCertificate).toHaveBeenCalledOnceWith(
                    new Uint8Array([1, 2, 3])
                )
            })
        })
    })

    describe('isSupported', () => {
        it('resolves to true if key access can be created from the given DrmInfo', async () => {
            // Suite setup resolves key system access
            await expectAsync(
                drmController.isSupported(drmInfo)
            ).toBeResolvedTo({
                supported: true,
                persistentState: false,
            })
            expect(commonEme.requestMediaKeySystemAccess).toHaveBeenCalledTimes(
                1
            )
        })

        it('resolves to false if key access cannot be created from the given DrmInfo', async () => {
            // Keep as separate test to reset memoization
            commonEme.requestMediaKeySystemAccess.and.rejectWith(
                new Error('not supported')
            )
            await expectAsync(
                drmController.isSupported(drmInfo)
            ).toBeResolvedTo({
                supported: false,
                persistentState: false,
            })
            expect(getKeySystemsRequested()).toEqual([
                DrmKeySystem.WIDEVINE,
                DrmKeySystem.PLAY_READY,
            ])
        })
    })

    describe('isEmeSupported', () => {
        it('returns true if commonEme dependency is provided', () => {
            expect(drmController.isEmeSupported()).toBeTrue()
            drmController = new DrmControllerImpl(
                {
                    ...deps,
                    commonEme: null,
                },
                { licenseProvider }
            )
            expect(drmController.isEmeSupported()).toBeFalse()
        })
    })

    describe('closeSessions', () => {
        it('clears active sessions', async () => {
            const sessionCloseSpy = createEventSpy(
                drmController,
                'sessionClose'
            )
            expect(drmController.activeSessions).toBe(0)
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
            expect(drmController.activeSessions).toBe(1)
            drmController.closeSessions()
            await flushPromises()
            expect(drmController.activeSessions).toBe(0)
            expect(activeSessions).toBe(0)
            expect(sessionCloseSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('reset', () => {
        it('clears error state', async () => {
            // Trigger error by making license provider fail
            licenseProvider.and.rejectWith(new Error('test error'))
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
            await emitMessage()

            expect(drmController.error).not.toBeNull()
            errorSpy.calls.reset() // Reset error spy to avoid afterEach failure

            drmController.reset()
            expect(drmController.error).toBeNull()
        })

        it('emits reset event', async () => {
            const resetSpy = jasmine.createSpy('reset')
            drmController.on('reset', resetSpy)

            // Trigger error by making license provider fail
            licenseProvider.and.rejectWith(new Error('test error'))
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
            await emitMessage()
            await flushPromises()
            errorSpy.calls.reset() // Reset error spy to avoid afterEach failure

            drmController.reset()

            expect(resetSpy).toHaveBeenCalledOnceWith({})
        })

        describe('when media is in a decoding error state', () => {
            it('does not attempt to retry license request', async () => {
                // Set up error state by making license provider fail
                licenseProvider.and.rejectWith(new Error('license failed'))
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted()

                // Trigger message to create pending message props
                await emitMessage()
                await flushPromises()
                expectError('license failed')

                // Set media to decoding error state
                const decodingError = new MockMediaError()
                decodingError.code = ReportableMediaError.MEDIA_ERR_DECODE
                media.error = decodingError

                // Reset should not retry license request
                licenseProvider.calls.reset()
                drmController.reset()
                await flushPromises()

                expect(licenseProvider).not.toHaveBeenCalled()
            })
        })

        describe('when media is not in a decoding error state', () => {
            it('retries license request', async () => {
                // Set up error state by making license provider fail initially
                licenseProvider.and.rejectWith(new Error('license failed'))
                drmController.setBufferingDrmInfo(drmInfo)
                await emitEncrypted()

                // Trigger message to create pending message props
                await emitMessage()
                expectError('license failed')

                // Media is not in error state (error is null)
                media.error = null

                // Make license provider succeed on retry
                licenseProvider.and.resolveTo(new Uint8Array([1, 2, 3]).buffer)
                licenseProvider.calls.reset()

                // Reset should retry license request
                drmController.reset()
                await flushPromises()

                expect(licenseProvider).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('configure', () => {
        it('overrides base options provided from the constructor', () => {
            drmController = new DrmControllerImpl(deps, {
                keySystems: {
                    [DrmKeySystem.WIDEVINE]: {
                        priority: 1,
                        audio: { robustness: DrmRobustness.SW_SECURE_CRYPTO },
                    },
                },
                licenseProvider,
            })

            drmController.configure({
                keySystems: {
                    [DrmKeySystem.WIDEVINE]: {
                        priority: 2,
                        video: { robustness: DrmRobustness.HW_SECURE_DECODE },
                    },
                    [DrmKeySystem.PLAY_READY]: {
                        priority: 3,
                    },
                },
            })

            // Verify the configuration was merged correctly by checking key system priority sorting
            drmController.setBufferingDrmInfo({
                ...drmInfo,
                contentProtections: [
                    { keySystem: DrmKeySystem.WIDEVINE },
                    { keySystem: DrmKeySystem.PLAY_READY },
                ],
            })

            commonEme.requestMediaKeySystemAccess.and.callFake((keySystem) => {
                return keySystem === DrmKeySystem.PLAY_READY
                    ? Promise.resolve(access)
                    : Promise.reject(new Error('not supported'))
            })

            drmController.initializeForPlayback({
                ...drmInfo,
                contentProtections: [
                    { keySystem: DrmKeySystem.WIDEVINE, pssh: '123' },
                    { keySystem: DrmKeySystem.PLAY_READY, pssh: '456' },
                ],
            })

            // PLAY_READY should be tried first due to higher priority (3 > 2)
            expect(getKeySystemsRequested()[0]).toBe(DrmKeySystem.PLAY_READY)
        })

        it('merges keySystems with base options', () => {
            drmController = new DrmControllerImpl(deps, {
                keySystems: {
                    [DrmKeySystem.WIDEVINE]: {
                        priority: 1,
                        audio: { robustness: DrmRobustness.SW_SECURE_CRYPTO },
                    },
                },
                licenseProvider,
            })

            drmController.configure({
                keySystems: {
                    [DrmKeySystem.PLAY_READY]: {
                        priority: 2,
                    },
                },
            })

            // Both key systems should be available after merge
            drmController.setBufferingDrmInfo({
                ...drmInfo,
                contentProtections: [
                    { keySystem: DrmKeySystem.WIDEVINE },
                    { keySystem: DrmKeySystem.PLAY_READY },
                ],
            })

            commonEme.requestMediaKeySystemAccess.and.rejectWith(
                new Error('not supported')
            )

            drmController.initializeForPlayback({
                ...drmInfo,
                contentProtections: [
                    { keySystem: DrmKeySystem.WIDEVINE, pssh: '123' },
                    { keySystem: DrmKeySystem.PLAY_READY, pssh: '456' },
                ],
            })

            // Both key systems should be attempted
            expect(getKeySystemsRequested()).toEqual([
                DrmKeySystem.PLAY_READY, // higher priority
            ])
        })
    })

    describe('wildcard key system configuration', () => {
        it('uses * as wildcard for key system configuration', async () => {
            drmController = new DrmControllerImpl(deps, {
                keySystems: {
                    '*': {
                        audio: { robustness: DrmRobustness.HW_SECURE_CRYPTO },
                        video: { robustness: DrmRobustness.HW_SECURE_DECODE },
                    },
                },
                licenseProvider,
            })

            drmController.setBufferingDrmInfo({
                ...drmInfo,
                contentType: 'audio',
                mimeType: 'audio/mp4',
            })

            await emitEncrypted()

            expect(commonEme.requestMediaKeySystemAccess).toHaveBeenCalledWith(
                DrmKeySystem.WIDEVINE,
                [
                    {
                        initDataTypes: ['cenc'],
                        audioCapabilities: [
                            {
                                contentType: 'audio/mp4',
                                encryptionScheme: 'cenc',
                                robustness: DrmRobustness.HW_SECURE_CRYPTO,
                            },
                        ],
                    },
                ]
            )
        })

        it('prefers specific key system configuration over wildcard', async () => {
            drmController = new DrmControllerImpl(deps, {
                keySystems: {
                    '*': {
                        audio: { robustness: DrmRobustness.SW_SECURE_CRYPTO },
                    },
                    [DrmKeySystem.WIDEVINE]: {
                        audio: { robustness: DrmRobustness.HW_SECURE_DECODE },
                    },
                },
                licenseProvider,
            })

            drmController.setBufferingDrmInfo({
                ...drmInfo,
                contentType: 'audio',
                mimeType: 'audio/mp4',
            })

            await emitEncrypted()

            expect(commonEme.requestMediaKeySystemAccess).toHaveBeenCalledWith(
                DrmKeySystem.WIDEVINE,
                [
                    {
                        initDataTypes: ['cenc'],
                        audioCapabilities: [
                            {
                                contentType: 'audio/mp4',
                                encryptionScheme: 'cenc',
                                robustness: DrmRobustness.HW_SECURE_DECODE, // specific config used
                            },
                        ],
                    },
                ]
            )
        })
    })

    describe('when a session has been created', () => {
        beforeEach(async () => {
            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
        })

        it('clears media keys from the element', async () => {
            drmController.dispose()
            await flushPromises()
            expect(mediaKeys.clearFromElement).toHaveBeenCalledOnceWith(media)
        })

        it('closes all sessions', async () => {
            await emitEncrypted(new Uint8Array([1, 2, 3]))
            await emitEncrypted(new Uint8Array([4, 5, 6]))

            expect(drmController.activeSessions).toBe(3)
            drmController.dispose()
            await flushPromises()
            expect(drmController.activeSessions).toBe(0)
            expect(activeSessions).toBe(0)
        })
    })

    describe('dispose', () => {
        it('removes handlers', () => {
            drmController.on('error', () => {})
            expect(drmController.hasAnyListeners()).toBeTrue()
            drmController.dispose()
            expect(drmController.hasAnyListeners()).toBeFalse()
        })
    })

    describe('licenseProvider fallback', () => {
        it('uses defaultLicenseProvider when no licenseProvider is provided', async () => {
            // Create controller without licenseProvider to test fallback
            drmController = new DrmControllerImpl(deps, {})
            errorSpy = createEventSpy(drmController, 'error')

            drmController.setBufferingDrmInfo(drmInfo)
            await emitEncrypted()
            await emitMessage()

            // Should use default license provider which will fail due to missing URL
            expectError(
                'Missing licenseServer url in DRM configuration for keySystem: com.widevine.alpha'
            )
        })
    })
})
