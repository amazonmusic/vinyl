/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@amazon/vinyl-util'

/**
 * API for WebKit-prefixed EME.
 * WebKitPrefixed EME is supported from iOS/iPadOS 11.3 and macOS 10.10.3
 *
 * Modern unprefixed EME for WebKit is supported starting iOS/iPadOS 12.2 and macOS 10.14.4
 *
 * https://developer.apple.com/documentation/webkitjs/webkitmediakeys
 * @module
 */

declare global {
    class WebKitMediaKeys {
        readonly keySystem: string

        constructor(keySystem: string)

        static isTypeSupported(keySystem: string, type?: Maybe<string>): boolean

        createSession(type: string, initData: Uint8Array): WebKitMediaKeySession
    }

    class WebKitMediaKeyError {
        static readonly MEDIA_KEYERR_UNKNOWN: number
        static readonly MEDIA_KEYERR_CLIENT: number
        static readonly MEDIA_KEYERR_SERVICE: number
        static readonly MEDIA_KEYERR_OUTPUT: number
        static readonly MEDIA_KEYERR_HARDWARECHANGE: number
        static readonly MEDIA_KEYERR_DOMAIN: number

        readonly code: number
        readonly systemCode: number
    }

    interface WebKitMediaKeySession extends EventTarget {
        readonly error: WebKitMediaKeyError | null
        readonly keySystem: string
        onwebkitkeyadded: EventListener | null
        onwebkitkeyerror: EventListener | null
        onwebkitkeymessage: EventListener | null
        sessionId: string

        close(): void

        update(key: Uint8Array<ArrayBuffer>): void

        addEventListener<K extends keyof WebKitMediaKeySessionEventMap>(
            type: K,
            listener: (
                this: WebKitMediaKeySession,
                ev: WebKitMediaKeySessionEventMap[K]
            ) => any,
            options?: boolean | AddEventListenerOptions
        ): void

        addEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void

        removeEventListener<K extends keyof WebKitMediaKeySessionEventMap>(
            type: K,
            listener: (
                this: WebKitMediaKeySession,
                ev: WebKitMediaKeySessionEventMap[K]
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

export interface WebKitMediaKeySessionEventMap {
    readonly webkitkeymessage: WebKitMediaKeyMessageEvent
    readonly webkitkeyerror: Event
}

export interface WebKitMediaKeyMessageEvent extends Event {
    readonly message: Uint8Array
}
