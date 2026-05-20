/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@amazon/vinyl-util'

// http://www.w3.org/TR/2014/WD-encrypted-media-20140218

/**
 * API for MS-prefixed EME.
 *
 * @module
 */

declare global {
    class MSMediaKeys {
        readonly keySystem: string

        constructor(keySystem: string)

        static isTypeSupported(keySystem: string, type?: Maybe<string>): boolean

        createSession(type: string, initData: Uint8Array): MSMediaKeySession
    }

    class MSMediaKeyError {
        static readonly MS_MEDIA_KEYERR_CLIENT: number
        static readonly MS_MEDIA_KEYERR_DOMAIN: number
        static readonly MS_MEDIA_KEYERR_HARDWARECHANGE: number
        static readonly MS_MEDIA_KEYERR_OUTPUT: number
        static readonly MS_MEDIA_KEYERR_SERVICE: number
        static readonly MS_MEDIA_KEYERR_UNKNOWN: number

        readonly code: number
        readonly systemCode: number
    }

    interface MSMediaKeySession extends EventTarget {
        readonly error: MSMediaKeyError | null
        readonly keySystem: string
        onmskeyadded: EventListener | null
        onmskeyerror: EventListener | null
        onmskeymessage: EventListener | null
        sessionId: string

        close(): void

        update(key: Uint8Array): void

        addEventListener<K extends keyof MSMediaKeySessionEventMap>(
            type: K,
            listener: (
                this: MSMediaKeySession,
                ev: MSMediaKeySessionEventMap[K]
            ) => any,
            options?: boolean | AddEventListenerOptions
        ): void

        addEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void

        removeEventListener<K extends keyof MSMediaKeySessionEventMap>(
            type: K,
            listener: (
                this: MSMediaKeySession,
                ev: MSMediaKeySessionEventMap[K]
            ) => any,
            options?: boolean | EventListenerOptions
        ): void

        removeEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions
        ): void
    }
}

export interface MSMediaKeySessionEventMap {
    readonly mskeymessage: MSMediaKeyMessageEvent
    readonly mskeyerror: Event
}

export interface MSMediaKeyMessageEvent extends Event {
    readonly message: Uint8Array
}
