/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AbortError,
    base64ToByteArray,
    buffersEqual,
    bufferToByteArray,
    clone,
    type Comparator,
    compareBy,
    createDisposer,
    ErrorOrigin,
    EventHostImpl,
    isSilentError,
    logDebug,
    logVerbose,
    type Maybe,
    memoize,
    noop,
    normalizeHeadersInit,
    type ReadonlyAbort,
    remove,
    resolveValueProvider,
    withTimeout,
} from '@amazon/vinyl-util'
import { instanceOf, object, type ObjectSchema } from '@amazon/vinyl-validation'
import {
    type DrmMediaKeySystemOptions,
    type DrmOptions,
    DrmRobustness,
    type InitDataTransformer,
} from '@/drm/DrmOptions'
import type {
    DrmController,
    DrmControllerEventMap,
    DrmKeySystemSupport,
} from '@/drm/DrmController'
import type {
    CommonEme,
    CommonMediaEncryptedEvent,
    CommonMediaKeyMessageEvent,
    CommonMediaKeys,
    CommonMediaKeySession,
    CommonMediaKeySystemAccess,
} from '@/drm/commonEme/CommonEme'
import { DrmError } from '@/drm/error/DrmError'
import type { EncryptedInitData } from '@/drm/commonEme/EncryptedInitData'
import { DrmKeySystem, isPlayReady } from '@/drm/DrmKeySystem'
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'
import type {
    ContentType,
    MediaFormatMetadata,
} from '@/streaming/MediaQualityMetadata'
import { unpackPlayReadyChallenge } from '@/drm/util/unpackPlayReadyChallenge'
import type {
    LicenseProvider,
    ServerCertificate,
} from '@/drm/licenseProvider/LicenseProvider'
import { defaultLicenseProvider } from '@/drm/licenseProvider/defaultLicenseProvider'
import { extractContentId } from '@/drm/util/extractContentId'
import { createFairPlaySessionInitData } from '@/drm/util/createFairPlaySessionInitData'

/**
 * The number of seconds a license request will be allowed before timing out.
 * This should be higher than the network timeout.
 *
 * In practice, network requests will time out before this, and a license timeout
 * indicates a stalled promise result from the license provider.
 */
export const LICENSE_TIMEOUT = 90
const LICENSE_TIMEOUT_MESSAGE = 'License provider timed out after {time}s'

/**
 * Dependencies for creating DrmController.
 */
export interface DrmControllerImplDeps {
    readonly media: HTMLMediaElement
    readonly commonEme: CommonEme | null
}

export interface DrmControllerMessageProps {
    readonly mediaKeys: CommonMediaKeys
    readonly session: CommonMediaKeySession
    readonly event: CommonMediaKeyMessageEvent
}

export class DrmControllerImpl
    extends EventHostImpl<DrmControllerEventMap>
    implements DrmController
{
    get [Symbol.toStringTag](): string {
        return 'DrmControllerImpl'
    }

    private readonly optionsBase: DrmOptions
    private options: DrmOptions

    private mediaKeys: CommonMediaKeys | null = null
    private mediaKeysPromise: Promise<CommonMediaKeys> | null = null
    private readonly sessions: CommonMediaKeySession[] = []

    private _error: Error | null = null
    private drmInfo: MediaFormatMetadata | null = null
    private sessionAbort: ReadonlyAbort | null = null

    private pendingMessageProps: DrmControllerMessageProps | null = null
    private readonly disposer = createDisposer()

    constructor(
        private readonly deps: DrmControllerImplDeps,
        options?: Maybe<Partial<DrmOptions>>
    ) {
        super()
        this.optionsBase = { keySystems: {}, ...options }
        this.options = this.optionsBase

        if (this.deps.commonEme) {
            this.disposer.add(
                this.deps.commonEme.addEncryptedListener(
                    this.deps.media,
                    this.handleEncryptedEvent
                )
            )
        }
    }

    configure(options: Maybe<Partial<DrmOptions>>): void {
        this.options = {
            ...this.optionsBase,
            ...options,
            keySystems: {
                ...this.optionsBase.keySystems,
                ...options?.keySystems,
            },
        }
    }

    private get licenseProvider(): LicenseProvider {
        return this.options.licenseProvider ?? defaultLicenseProvider
    }

    get error(): Error | null {
        return this._error
    }

    isEmeSupported(): boolean {
        return this.deps.commonEme != null
    }

    async isSupported(
        drmInfo: MediaFormatMetadata
    ): Promise<DrmKeySystemSupport> {
        const accessParamsList = this.createMediaKeySystemAccessParams(drmInfo)
        for (const params of accessParamsList) {
            const result = await this.checkIsSupportedCached(params)
            if (result.supported) return result
        }
        return { supported: false, persistentState: false }
    }

    private checkIsSupportedCached = memoize(
        async (
            params: MediaKeySystemAccessParams
        ): Promise<DrmKeySystemSupport> => {
            try {
                await this.deps.commonEme!.requestMediaKeySystemAccess(
                    params.keySystem,
                    [params.config]
                )
                logVerbose(
                    this,
                    'requestMediaKeySystemAccess supported',
                    params
                )
                return {
                    supported: true,
                    persistentState:
                        params.config.persistentState === 'required',
                }
            } catch (_) {
                logVerbose(this, 'requestMediaKeySystemAccess rejected', params)
                return { supported: false, persistentState: false }
            }
        },
        (options) => options.cacheKey,
        20 // capacity
    )

    private readonly handleEncryptedEvent = (
        event: CommonMediaEncryptedEvent
    ) => {
        if (this.disposed) return
        ;(async () => {
            const { initData, initDataType } = event
            if (!initData) {
                // https://www.w3.org/TR/2014/WD-encrypted-media-20140218/#dom-mediakeyneededevent
                // https://www.w3.org/TR/encrypted-media/#initialization-data
                // Initialization data could not be obtained, possibly due to cross-origin policy issues.
                throw new DrmError(
                    'encrypted event provided null initData. Check CORS policies.'
                )
            }
            logDebug(
                this,
                `encrypted, initDataType: ${initDataType}, initData.byteLength: ${initData.byteLength}`
            )
            if (!this.drmInfo?.contentProtections.length) {
                throw new DrmError(
                    'Encrypted content not configured with content protections.'
                )
            }
            await this.maybeCreateSession(
                this.drmInfo,
                initDataType,
                initData,
                this.sessionAbort
            )
        })().catch(this.handleError)
    }

    /**
     * Resolves to media keys attached to the element.
     * The media keys will only be created and set once until `clearMediaKeys` is next called.
     */
    private async attachMediaKeys(
        drmInfo: MediaFormatMetadata
    ): Promise<CommonMediaKeys> {
        if (!this.mediaKeysPromise) {
            this.mediaKeysPromise = (async () => {
                logDebug(this, 'creating media keys')
                const access = await this.createAccess(drmInfo)
                const mediaKeys = await access.createMediaKeys()
                this.abortIfDisposed()
                this.mediaKeys = mediaKeys
                await mediaKeys.setOnElement(this.deps.media)
                logDebug(this, `set media keys on element`)
                this.dispatch('mediaKeysSet', {
                    keySystem: mediaKeys.keySystem,
                })
                return mediaKeys
            })()
        }
        return this.mediaKeysPromise
    }

    /**
     * Creates a session for the given initialization data if none currently exists.
     * This will be done either after an 'encrypted' event or when drm metadata contains initialization data.
     * The new session will be added to the current sessions list.
     */
    private async maybeCreateSession(
        drmInfo: MediaFormatMetadata,
        initDataType: DrmInitDataType,
        initData: EncryptedInitData,
        abort?: Maybe<ReadonlyAbort>
    ): Promise<CommonMediaKeySession> {
        if (!hasMimeType(drmInfo)) {
            throw new DrmError('Encrypted content must have a mimeType.')
        }

        const mediaKeys = await this.attachMediaKeys(drmInfo)
        this.abortIfDisposed()

        // Resolve server certificate from configuration
        const keySystemOptions =
            this.options.keySystems[mediaKeys.keySystem] ??
            this.options.keySystems['*']
        const licenseServerOptionsProvider = keySystemOptions?.licenseServer
        const licenseServerOptions = await resolveValueProvider(
            licenseServerOptionsProvider ?? {}
        )
        this.abortIfDisposed()
        const existingSession = this.getSessionByInitData(initData)
        if (existingSession) {
            logDebug(this, 'reusing session')
            return existingSession
        } else {
            const newSession = await this.createNewSession(
                licenseServerOptions.serverCertificate,
                mediaKeys,
                initData,
                initDataType,
                drmInfo,
                keySystemOptions?.initDataTransformer
            )
            this.sessions.push(newSession)
            this.dispatch('sessionCreate', {
                initDataType: newSession.initDataType,
                mimeType: newSession.mimeType,
            })
            newSession.on('closed', () => this.closeSession(newSession))
            abort?.onAborted(() => {
                logDebug(this, 'abort session')
                this.closeSession(newSession)
            })
            return newSession
        }
    }

    initializeForPlayback(
        drmInfo: MediaFormatMetadata | null,
        abort?: ReadonlyAbort
    ): void {
        logDebug(this, 'initializeForPlayback', drmInfo)
        if (drmInfo?.contentProtections.length) {
            this.createSessionFromInitData(drmInfo, abort).catch(
                this.handleError
            )
        }
    }

    setBufferingDrmInfo(
        drmInfo: MediaFormatMetadata | null,
        abort?: ReadonlyAbort
    ): void {
        logDebug(this, 'setBufferingDrmInfo', drmInfo)
        // Reset 'encrypted' error reporting
        this.reset()
        this.drmInfo = drmInfo
        this.sessionAbort = abort ?? null
    }

    /**
     * If the drm metadata contains initialization data for the current key system, create a new session.
     * Otherwise, wait for the 'encrypted' event for the initialization data.
     */
    private async createSessionFromInitData(
        drmInfo: MediaFormatMetadata,
        abort?: ReadonlyAbort
    ) {
        if (!this.deps.commonEme) {
            this.handleError(new DrmError('DRM not supported.'))
            return
        }
        const mediaKeys = await this.attachMediaKeys(drmInfo)
        const drmProtection =
            drmInfo.contentProtections.find((cP) => {
                return cP.keySystem === mediaKeys.keySystem
            }) ?? null

        if (!drmProtection) {
            // Media keys have been initialized, but content is not encrypted with the current keySystem.
            throw new DrmError(
                `Encrypted content does not support set keySystem: '${mediaKeys.keySystem}'.`,
                { drmInfo }
            )
        }
        if (drmProtection.pssh) {
            await this.maybeCreateSession(
                drmInfo,
                drmInfo.initDataType ?? 'cenc',
                base64ToByteArray(drmProtection.pssh),
                abort
            )
        }
    }

    /**
     * Creates a CommonMediaKeySystemAccess object from the given content protection settings.
     */
    private async createAccess(
        drmInfo: MediaFormatMetadata
    ): Promise<CommonMediaKeySystemAccess> {
        const accessParamsList = this.createMediaKeySystemAccessParams(drmInfo)
        for (const { keySystem, config } of accessParamsList) {
            try {
                const access =
                    await this.deps.commonEme!.requestMediaKeySystemAccess(
                        keySystem,
                        [config]
                    )
                logDebug(
                    this,
                    `created media key system access for keySystem: ${access.keySystem}}`,
                    config
                )
                return access
            } catch (_) {
                // ignore
            }
        }
        throw new DrmError(
            `No keySystem supported`,
            {
                contentProtections: drmInfo as any,
                attemptedKeySystems: accessParamsList.map(
                    (arr) => arr.keySystem
                ),
            },
            ErrorOrigin.DRM
        )
    }

    /**
     * Creates a list of the MediaKeySystemAccess configurations to try for the given media format options.
     */
    private createMediaKeySystemAccessParams(
        drmInfo: MediaFormatMetadata
    ): readonly MediaKeySystemAccessParams[] {
        const keySystems = drmInfo.contentProtections
            .map((protection) => protection.keySystem)
            .sort(this.keySystemComparator)

        return keySystems.map((keySystem): MediaKeySystemAccessParams => {
            const mediaOptions = this.getMediaKeySystemOptions(
                keySystem,
                drmInfo.contentType
            )
            const capability: MediaKeySystemMediaCapability = {
                robustness:
                    mediaOptions?.robustness ?? DrmRobustness.SW_SECURE_CRYPTO,
                encryptionScheme: drmInfo.encryptionScheme,
            }
            if (drmInfo.mimeType) {
                capability.contentType = drmInfo.mimeType
            }
            const config: MediaKeySystemConfiguration = {
                initDataTypes: [drmInfo.initDataType ?? 'cenc'],
            }
            const contentType = drmInfo.contentType
            if (contentType === 'video') {
                config.videoCapabilities = [capability]
            } else if (contentType === 'audio') {
                config.audioCapabilities = [capability]
            }
            return {
                keySystem,
                config,
                // Concatenate a list of inputs to use as a cache key for isSupported checks.
                cacheKey: [
                    keySystem,
                    drmInfo.mimeType,
                    drmInfo.contentType,
                    capability.robustness,
                    drmInfo.encryptionScheme,
                    drmInfo.initDataType,
                ]
                    .map(String)
                    .join('|'),
            }
        })
    }

    private getMediaKeySystemOptions(
        keySystem: DrmKeySystem,
        contentType: Maybe<ContentType>
    ): DrmMediaKeySystemOptions | undefined {
        const keySystems = this.options.keySystems
        const keySystemOptions = keySystems[keySystem] ?? keySystems['*']
        if (!keySystemOptions) return undefined
        switch (contentType) {
            case 'video':
                return keySystemOptions.video
            case 'audio':
                return keySystemOptions.audio
            default:
                return undefined
        }
    }

    /**
     * Creates a new key session and adds a message handler.
     */
    private async createNewSession(
        serverCertificate: Maybe<ServerCertificate>,
        mediaKeys: CommonMediaKeys,
        initData: EncryptedInitData,
        initDataType: DrmInitDataType,
        drmInfo: MediaFormatMetadata & { readonly mimeType: string },
        initDataTransformer?: InitDataTransformer
    ): Promise<CommonMediaKeySession> {
        const certBytes = serverCertificate
            ? typeof serverCertificate === 'string'
                ? base64ToByteArray(serverCertificate)
                : bufferToByteArray(serverCertificate)
            : null

        if (certBytes) {
            await mediaKeys.setServerCertificate(certBytes)
        }

        // Default initDataTransformer handles FAIR_PLAY_1_0 by packing the
        // skd init data with the content ID and server certificate.
        // FAIR_PLAY_1_0 always uses initDataType 'skd', so the default
        // does not need to explicitly check initDataType.
        const transform =
            initDataTransformer ??
            defaultInitDataTransformer(mediaKeys.keySystem, certBytes)
        initData = transform(bufferToByteArray(initData), initDataType, drmInfo)

        logDebug(this, 'createSession', drmInfo.mimeType, initDataType)
        const session = mediaKeys.createSession(
            drmInfo.mimeType,
            initDataType,
            initData
        )
        session.on('message', (event) => {
            withTimeout(
                this.messageHandler({
                    mediaKeys: mediaKeys,
                    session: session,
                    event: event,
                }),
                LICENSE_TIMEOUT,
                LICENSE_TIMEOUT_MESSAGE
            ).catch(this.handleError)
        })
        session.on('error', (event) => {
            this.closeSession(session)
            this.handleError(event.error)
        })
        return session
    }

    /**
     * Invoked when the content decryption module needs to interact with the license server.
     */
    private async messageHandler(
        messageProps: DrmControllerMessageProps
    ): Promise<void> {
        const { mediaKeys, session, event } = messageProps
        messageEventValidator.assert(event)
        this.pendingMessageProps = messageProps

        const keySystem = mediaKeys.keySystem
        logDebug(this, 'message', keySystem, event.message.byteLength)

        const keySystemOptions = this.options.keySystems[keySystem]
        const licenseServerOptionsProvider = keySystemOptions?.licenseServer

        // Get the license server configuration for the current key system.
        const licenseServerOptions =
            clone(await resolveValueProvider(licenseServerOptionsProvider)) ??
            {}

        let challenge: BodyInit = event.message
        if (isPlayReady(keySystem)) {
            const unpacked = unpackPlayReadyChallenge(challenge)
            challenge = unpacked.challenge
            if (licenseServerOptions.init == null)
                licenseServerOptions.init = {}
            licenseServerOptions.init.headers = {
                ...normalizeHeadersInit(
                    licenseServerOptions.init.headers ?? {}
                ),
                ...unpacked.headers,
            }
        }
        const key = await this.licenseProvider(
            keySystem,
            licenseServerOptions,
            challenge
        )
        this.pendingMessageProps = null
        if (session.disposed) return
        logDebug(this, 'update')
        await session.update(key)
    }

    //--------------------------------------------
    // Session management
    //--------------------------------------------

    /**
     * Closes all active DRM sessions.
     * This should not be called unless the audio source has been cleared.
     */
    closeSessions() {
        logDebug(this, `clearing ${this.sessions.length} sessions`)
        while (this.sessions.length) this.closeSession(this.sessions[0])
    }

    private closeSession(session: CommonMediaKeySession) {
        logDebug(this, 'closeSession')
        session.dispose()
        remove(this.sessions, session)
        this.dispatch('sessionClose', {
            initDataType: session.initDataType,
            mimeType: session.mimeType,
        })
    }

    /**
     * A handler which dispatches an error event.
     * Only one error event will be emitted per unique PSSH.
     * When track protections is set again, another error event may be emitted.
     */
    private readonly handleError = (error: Error) => {
        if (!this._error && !isSilentError(error)) {
            this._error = error
            this.dispatch('error', { error, target: this })
        }
    }

    /**
     * Returns the number of currently active sessions.
     */
    get activeSessions(): number {
        return this.sessions.length
    }

    /**
     * Clears the media keys from the element if they were set.
     */
    private clearMediaKeys() {
        this.closeSessions()
        if (this.mediaKeys) {
            logDebug(this, 'clearing media keys')
            this.mediaKeys.clearFromElement(this.deps.media).catch(noop)
            this.mediaKeys = null
        }
        this.mediaKeysPromise = null
    }

    protected abortIfDisposed() {
        if (this.disposed) throw new AbortError()
    }

    reset() {
        if (!this._error) {
            logDebug(this, 'reset no-op')
            return
        }
        logDebug(this, 'reset')
        this._error = null
        if (this.pendingMessageProps) {
            const mediaError = this.deps.media.error
            if (mediaError && mediaError.code === mediaError.MEDIA_ERR_DECODE) {
                // Media is in a failed decoding state, cannot recover from a failed license request.
                // The PlaybackController will attempt a reset.
                logDebug(
                    this,
                    'media in an error state, will not retry failed license challenge'
                )
                this.pendingMessageProps = null
            } else {
                logDebug(this, 'retrying failed license challenge')
                this.messageHandler(this.pendingMessageProps).catch(
                    this.handleError
                )
            }
        }
        this.dispatch('reset', {})
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose(): void {
        logDebug(this, 'dispose')
        super.dispose()
        this.clearMediaKeys()
        this.disposer.dispose()
    }

    private getSessionByInitData(
        initData: EncryptedInitData
    ): CommonMediaKeySession | null {
        return (
            this.sessions.find((session) => {
                return buffersEqual(session.initData, initData)
            }) ?? null
        )
    }

    /**
     * Sort the key systems first by their priority, then by the presence of a license uri.
     */
    private readonly keySystemComparator: Comparator<DrmKeySystem> = compareBy(
        (keySystem: DrmKeySystem) => {
            return -(this.options.keySystems[keySystem]?.priority ?? 0)
        },
        (keySystem: DrmKeySystem) => {
            return this.options.keySystems[keySystem]?.licenseServer != null
                ? 0
                : 1
        }
    )
}

interface MediaKeySystemAccessParams {
    readonly keySystem: DrmKeySystem
    readonly config: MediaKeySystemConfiguration
    readonly cacheKey: string
}

const messageEventValidator: ObjectSchema<CommonMediaKeyMessageEvent> = object({
    message: instanceOf(ArrayBuffer),
})

function hasMimeType(
    drmInfo: MediaFormatMetadata
): drmInfo is MediaFormatMetadata & { readonly mimeType: string } {
    return drmInfo.mimeType != null
}

/**
 * Default initDataTransformer. For FAIR_PLAY_1_0, packs the skd init data
 * with the extracted content ID and server certificate into the format
 * expected by WebKit-prefixed EME. FAIR_PLAY_1_0 always uses initDataType
 * 'skd', so we only need to check the key system.
 * For all other key systems, returns init data unchanged.
 */
function defaultInitDataTransformer(
    keySystem: DrmKeySystem,
    certBytes: Uint8Array<ArrayBuffer> | null
): InitDataTransformer {
    return (initData: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
        if (keySystem === DrmKeySystem.FAIR_PLAY_1_0) {
            if (!certBytes) {
                throw new DrmError('FairPlay requires certificate data')
            }
            const contentId = extractContentId(initData)
            return createFairPlaySessionInitData(initData, contentId, certBytes)
        }
        return initData
    }
}
