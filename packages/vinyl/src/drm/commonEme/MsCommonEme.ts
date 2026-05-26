/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    bufferToByteArray,
    type Disposable,
    DisposedError,
    ErrorOrigin,
    EventHostImpl,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import {
    type CommonEme,
    type CommonMediaKeys,
    type CommonMediaKeySession,
    CommonMediaKeySessionError,
    type CommonMediaKeySessionEventMap,
    type CommonMediaKeySystemAccess,
    MediaKeySessionErrorType,
} from './CommonEme'
import type { DrmKeySystem } from '@/drm/DrmKeySystem'
import { type EncryptedInitData } from './EncryptedInitData'
import type { MSMediaKeyMessageEvent } from '@/drm/dom/MSMediaKeys'
import { DrmError } from '@/drm/error/DrmError'
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'

declare global {
    interface HTMLMediaElementEventMap extends HTMLElementEventMap {
        readonly msneedkey: MSMediaKeyNeededEvent
    }

    interface MSMediaKeyNeededEvent extends Event {
        readonly initDataType: string
        readonly initData: Uint8Array<ArrayBuffer> | null
    }
}

/**
 * A CommonEme implementation of MS prefixed Encrypted Media Extensions as supported by IE11/Edge.
 */
export class MsCommonEme implements CommonEme {
    requestMediaKeySystemAccess(
        keySystem: DrmKeySystem,
        supportedConfigurations: readonly MediaKeySystemConfiguration[]
    ): Promise<CommonMediaKeySystemAccess> {
        for (const config of supportedConfigurations) {
            const capabilities = [
                ...(config.audioCapabilities ?? []),
                ...(config.videoCapabilities ?? []),
            ]
            for (const capability of capabilities) {
                if (
                    MSMediaKeys.isTypeSupported(
                        keySystem,
                        capability.contentType
                    )
                ) {
                    return Promise.resolve(
                        new MsCommonMediaKeySystemAccess(keySystem)
                    )
                }
            }
        }
        return Promise.reject(
            new DrmError(
                `keySystem not supported: ${keySystem}`,
                { keySystem },
                ErrorOrigin.DRM
            )
        )
    }

    /**
     * Listens to the element for an encrypted event, returning a disposable handle.
     */
    addEncryptedListener(
        element: HTMLMediaElement,
        handler: (event: MediaEncryptedEvent) => void
    ): Unsubscribe {
        const event = 'msneedkey'
        element.addEventListener(event, handler as EventListener)
        return () =>
            element.removeEventListener(event, handler as EventListener)
    }
}

export class MsCommonMediaKeySystemAccess implements CommonMediaKeySystemAccess {
    constructor(readonly keySystem: DrmKeySystem) {}

    createMediaKeys(): Promise<CommonMediaKeys> {
        const msMediaKeys = new MSMediaKeys(this.keySystem)
        return Promise.resolve(
            new MsCommonMediaKeys(this.keySystem, msMediaKeys)
        )
    }
}

/**
 * @private
 */
export class MsCommonMediaKeys implements CommonMediaKeys {
    constructor(
        public readonly keySystem: DrmKeySystem,
        public readonly mediaKeys: MSMediaKeys
    ) {}

    /**
     * Sets the media keys on the given element.
     */
    setOnElement(element: HTMLMediaElement): Promise<void> {
        element.msSetMediaKeys!(this.mediaKeys)
        return Promise.resolve()
    }

    /**
     * Clears the media keys from the given element.
     */
    clearFromElement(element: HTMLMediaElement): Promise<void> {
        element.msSetMediaKeys!(null)
        return Promise.resolve()
    }

    setServerCertificate(_certificate: BufferSource): Promise<boolean> {
        return Promise.resolve(false)
    }

    createSession(
        mimeType: string,
        initDataType: DrmInitDataType,
        initData: EncryptedInitData
    ): CommonMediaKeySession {
        const session = this.mediaKeys.createSession(
            mimeType,
            bufferToByteArray(initData)
        )
        return new MsCommonMediaKeySession(
            session,
            mimeType,
            initDataType,
            initData
        )
    }
}

/**
 * @private
 */
export class MsCommonMediaKeySession
    extends EventHostImpl<CommonMediaKeySessionEventMap>
    implements CommonMediaKeySession, Disposable
{
    private _disposed: boolean = false

    constructor(
        private readonly session: MSMediaKeySession,
        readonly mimeType: string,
        readonly initDataType: DrmInitDataType,
        readonly initData: EncryptedInitData
    ) {
        super()
        session.addEventListener('mskeymessage', this.messageHandler)
        session.addEventListener('mskeyerror', this.errorHandler)
    }

    private readonly messageHandler = (event: MSMediaKeyMessageEvent) => {
        this.dispatch('message', {
            message: event.message.buffer as ArrayBuffer,
        })
    }

    private readonly errorHandler = (): void => {
        if (this.session.error) {
            const e = this.session.error
            const error = new CommonMediaKeySessionError(
                e.code,
                msErrorCodeToStr(e.code),
                e.systemCode,
                msErrorCodeToStr(e.systemCode)
            )
            this.dispatch('error', { error, target: this })
        }
    }

    update(key: ArrayBuffer): Promise<void> {
        if (this.disposed) return Promise.reject(new DisposedError())
        this.session.update(new Uint8Array(key))
        return Promise.resolve()
    }

    get disposed(): boolean {
        return this._disposed
    }

    dispose(): void {
        super.dispose()
        this._disposed = true
        this.session.close()
        this.session.removeEventListener('mskeymessage', this.messageHandler)
        this.session.removeEventListener('mskeyerror', this.errorHandler)
    }
}

/**
 * Returns a string for the WebKit media key error.
 */
export function msErrorCodeToStr(code: number): MediaKeySessionErrorType {
    switch (code) {
        case MSMediaKeyError.MS_MEDIA_KEYERR_CLIENT:
            return MediaKeySessionErrorType.CLIENT
        case MSMediaKeyError.MS_MEDIA_KEYERR_DOMAIN:
            return MediaKeySessionErrorType.DOMAIN
        case MSMediaKeyError.MS_MEDIA_KEYERR_HARDWARECHANGE:
            return MediaKeySessionErrorType.HARDWARECHANGE
        case MSMediaKeyError.MS_MEDIA_KEYERR_OUTPUT:
            return MediaKeySessionErrorType.OUTPUT
        case MSMediaKeyError.MS_MEDIA_KEYERR_SERVICE:
            return MediaKeySessionErrorType.SERVICE
        case MSMediaKeyError.MS_MEDIA_KEYERR_UNKNOWN:
        default:
            return MediaKeySessionErrorType.UNKNOWN
    }
}
