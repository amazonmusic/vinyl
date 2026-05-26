/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Disposable,
    DisposedError,
    EventHostImpl,
    noop,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type {
    CommonEme,
    CommonMediaEncryptedEvent,
    CommonMediaKeyMessageEvent,
    CommonMediaKeys,
    CommonMediaKeySession,
    CommonMediaKeySessionEventMap,
    CommonMediaKeySystemAccess,
} from './CommonEme'
import type { DrmKeySystem } from '@/drm/DrmKeySystem'
import { type EncryptedInitData } from './EncryptedInitData'
import { createDrmErrorHandler } from './createDrmErrorHandler'
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'

/**
 * A CommonEme implementation of unprefixed Encrypted Media Extensions.
 */
export class StandardCommonEme implements CommonEme {
    async requestMediaKeySystemAccess(
        keySystem: DrmKeySystem,
        supportedConfigurations: readonly MediaKeySystemConfiguration[]
    ): Promise<CommonMediaKeySystemAccess> {
        const access = await navigator
            .requestMediaKeySystemAccess(keySystem, supportedConfigurations)
            .catch(createDrmErrorHandler())
        return new StandardCommonMediaKeySystemAccess(keySystem, access)
    }

    addEncryptedListener(
        element: HTMLMediaElement,
        handler: (event: CommonMediaEncryptedEvent) => void
    ): Unsubscribe {
        element.addEventListener('encrypted', handler)
        return () => element.removeEventListener('encrypted', handler)
    }
}

/**
 * CommonMediaKeySystemAccess for unprefixed EME implementations.
 */
export class StandardCommonMediaKeySystemAccess implements CommonMediaKeySystemAccess {
    constructor(
        public readonly keySystem: DrmKeySystem,
        private readonly access: MediaKeySystemAccess
    ) {}

    /**
     * @return {Promise<CommonMediaKeys>}
     */
    async createMediaKeys(): Promise<CommonMediaKeys> {
        const mediaKeys = await this.access
            .createMediaKeys()
            .catch(createDrmErrorHandler())
        return new StandardCommonMediaKeys(this.keySystem, mediaKeys)
    }
}

/**
 * CommonMediaKeys for unprefixed EME implementations.
 */
export class StandardCommonMediaKeys implements CommonMediaKeys {
    constructor(
        public readonly keySystem: DrmKeySystem,
        private readonly mediaKeys: MediaKeys
    ) {}

    setOnElement(element: HTMLMediaElement): Promise<void> {
        return element.setMediaKeys(this.mediaKeys)
    }

    clearFromElement(element: HTMLMediaElement): Promise<void> {
        return element.setMediaKeys(null)
    }

    async setServerCertificate(certificate: BufferSource): Promise<boolean> {
        return this.mediaKeys.setServerCertificate(certificate)
    }

    createSession(
        mimeType: string,
        initDataType: DrmInitDataType,
        initData: EncryptedInitData
    ): CommonMediaKeySession {
        return new StandardCommonMediaKeySession(
            this.mediaKeys.createSession('temporary'),
            mimeType,
            initDataType,
            initData
        )
    }
}

/**
 * CommonMediaKeySession for unprefixed EME implementations.
 */
export class StandardCommonMediaKeySession
    extends EventHostImpl<CommonMediaKeySessionEventMap>
    implements CommonMediaKeySession, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'StandardCommonMediaKeySession'
    }

    private _disposed = false

    private readonly messageHandler = (event: CommonMediaKeyMessageEvent) => {
        this.dispatch('message', {
            message: event.message,
        })
    }

    constructor(
        private readonly session: MediaKeySession,
        readonly mimeType: string,
        readonly initDataType: DrmInitDataType,
        readonly initData: EncryptedInitData
    ) {
        super()
        session.addEventListener('message', this.messageHandler)
        if ((session as any).closed) {
            // Compatibility: React Native MSE does not provide a 'closed' promise.
            session.closed
                .then((reason) => {
                    this.dispatch('closed', {
                        reason,
                    })
                })
                .catch(noop)
        }
        this.generateRequest().catch((error) => {
            this.dispatch('error', {
                error,
                target: this,
            })
        })
    }

    private generateRequest(): Promise<void> {
        const initData = this.initData
        return this.session
            .generateRequest(
                this.initDataType,
                initData instanceof ArrayBuffer ? initData : initData.buffer
            )
            .catch(createDrmErrorHandler())
    }

    update(key: ArrayBufferLike): Promise<void> {
        if (this.disposed) throw new DisposedError()
        return this.session.update(key as ArrayBuffer)
    }

    get disposed(): boolean {
        return this._disposed
    }

    dispose(): void {
        super.dispose()
        this._disposed = true
        this.session.removeEventListener('message', this.messageHandler)
        this.session.close().catch(noop)
    }
}
