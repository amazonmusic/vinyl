/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Unsubscribe } from '@amazon/vinyl-util'
import {
    bufferToByteArray,
    type Disposable,
    DisposedError,
    ErrorOrigin,
    EventHostImpl,
} from '@amazon/vinyl-util'
import type {
    CommonEme,
    CommonMediaEncryptedEvent,
    CommonMediaKeys,
    CommonMediaKeySession,
    CommonMediaKeySessionEventMap,
    CommonMediaKeySystemAccess,
} from './CommonEme'
import {
    CommonMediaKeySessionError,
    MediaKeySessionErrorType,
} from './CommonEme'
import type { WebKitMediaKeyMessageEvent } from '@/drm/dom/WebKitMediaKeys'
import type { DrmKeySystem } from '@/drm/DrmKeySystem'
import { DrmError } from '@/drm/error/DrmError'
import type { EncryptedInitData } from '@/drm/commonEme/EncryptedInitData'
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'

declare global {
    interface HTMLMediaElementEventMap extends HTMLElementEventMap {
        readonly webkitneedkey: WebKitMediaKeyNeededEvent
    }

    interface WebKitMediaKeyNeededEvent extends Event {
        readonly initDataType: string
        readonly initData: Uint8Array<ArrayBuffer> | null
    }
}

/**
 * A CommonEme implementation of WebKit-prefixed Encrypted Media Extensions.
 */
export class WebKitCommonEme implements CommonEme {
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
                    WebKitMediaKeys.isTypeSupported(
                        keySystem,
                        capability.contentType
                    )
                ) {
                    return Promise.resolve(
                        new WebKitCommonMediaKeySystemAccess(keySystem)
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

    addEncryptedListener(
        element: HTMLMediaElement,
        handler: (event: CommonMediaEncryptedEvent) => void
    ): Unsubscribe {
        element.addEventListener('webkitneedkey', handler)
        return () => element.removeEventListener('webkitneedkey', handler)
    }
}

export class WebKitCommonMediaKeySystemAccess implements CommonMediaKeySystemAccess {
    constructor(public readonly keySystem: DrmKeySystem) {}

    createMediaKeys(): Promise<CommonMediaKeys> {
        const webKitMediaKeys = new WebKitMediaKeys(this.keySystem)
        const webkitCommonMediaKeys = new WebKitCommonMediaKeys(
            this.keySystem,
            webKitMediaKeys
        )
        return Promise.resolve(webkitCommonMediaKeys)
    }
}

/** @private */
export class WebKitCommonMediaKeys implements CommonMediaKeys {
    constructor(
        public readonly keySystem: DrmKeySystem,
        public readonly mediaKeys: WebKitMediaKeys
    ) {}

    /**
     * Sets the media keys on the given element.
     */
    setOnElement(element: HTMLMediaElement): Promise<void> {
        element.webkitSetMediaKeys!(this.mediaKeys)
        return Promise.resolve()
    }

    /**
     * Clears the media keys from the given element.
     */
    clearFromElement(element: HTMLMediaElement): Promise<void> {
        element.webkitSetMediaKeys!(null)
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
        return new WebKitCommonMediaKeySession(
            session,
            mimeType,
            initDataType,
            initData
        )
    }
}

/** @private */
export class WebKitCommonMediaKeySession
    extends EventHostImpl<CommonMediaKeySessionEventMap>
    implements CommonMediaKeySession, Disposable
{
    private _disposed: boolean = false

    constructor(
        private readonly session: WebKitMediaKeySession,
        readonly mimeType: string,
        readonly initDataType: DrmInitDataType,
        readonly initData: EncryptedInitData
    ) {
        super()
        session.addEventListener('webkitkeymessage', this.messageHandler)
        session.addEventListener('webkitkeyerror', this.errorHandler)
    }

    private readonly messageHandler = (event: WebKitMediaKeyMessageEvent) => {
        this.dispatch('message', {
            message: event.message.buffer as ArrayBuffer,
        })
    }

    private readonly errorHandler = () => {
        if (this.session.error) {
            const e = this.session.error
            const error = new CommonMediaKeySessionError(
                e.code,
                webkitErrorCodeToStr(e.code),
                e.systemCode,
                webkitErrorCodeToStr(e.systemCode)
            )
            this.dispatch('error', { error, target: this })
        }
    }

    update(key: ArrayBuffer): Promise<void> {
        if (this.disposed) return Promise.reject(new DisposedError())
        this.session.update(new Uint8Array(key))
        return Promise.resolve()
    }

    get disposed() {
        return this._disposed
    }

    dispose(): void {
        super.dispose()
        this._disposed = true
        this.session.removeEventListener(
            'webkitkeymessage',
            this.messageHandler
        )
        this.session.removeEventListener('webkitkeyerror', this.errorHandler)
        // Do not wait on close, and ignore errors.
        this.session.close()
    }
}

/**
 * Returns a string for the WebKit media key error.
 */
export function webkitErrorCodeToStr(code: number): MediaKeySessionErrorType {
    switch (code) {
        case WebKitMediaKeyError.MEDIA_KEYERR_CLIENT:
            return MediaKeySessionErrorType.CLIENT
        case WebKitMediaKeyError.MEDIA_KEYERR_DOMAIN:
            return MediaKeySessionErrorType.DOMAIN
        case WebKitMediaKeyError.MEDIA_KEYERR_HARDWARECHANGE:
            return MediaKeySessionErrorType.HARDWARECHANGE
        case WebKitMediaKeyError.MEDIA_KEYERR_OUTPUT:
            return MediaKeySessionErrorType.OUTPUT
        case WebKitMediaKeyError.MEDIA_KEYERR_SERVICE:
            return MediaKeySessionErrorType.SERVICE
        case WebKitMediaKeyError.MEDIA_KEYERR_UNKNOWN:
        default:
            return MediaKeySessionErrorType.UNKNOWN
    }
}
