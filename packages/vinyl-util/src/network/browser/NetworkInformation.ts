/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NetworkInformationEventMap {
    readonly change: Event
}

export type NetworkInformationEffectiveType = 'slow-2g' | '2g' | '3g' | '4g'
export type NetworkInformationType =
    | 'bluetooth'
    | 'cellular'
    | 'ethernet'
    | 'none'
    | 'wifi'
    | 'wimax'
    | 'other'
    | 'unknown'

/**
 * Provides information about the system’s current network connection,
 * such as estimated bandwidth, round-trip time, and connection type.
 * Also exposes events for monitoring changes to the network state.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation
 */
export interface NetworkInformation extends EventTarget {
    /**
     * Approximate downlink speed in megabits per second.
     * Rounded to the nearest 25 kbps, based on recent throughput
     * over active connections. May be undefined if no estimate is available.
     */
    readonly downlink: number | undefined

    /**
     * A string describing the general quality of the connection
     * (for example, "4g", "3g"). Determined from both downlink
     * and latency estimates.
     */
    readonly effectiveType: NetworkInformationEffectiveType

    /**
     * Estimated round-trip latency of the current connection in milliseconds,
     * rounded to the nearest multiple of 25 ms.
     */
    readonly rtt: number

    /**
     * Indicates whether the user has requested reduced data usage
     * in the user agent’s settings.
     */
    readonly saveData: boolean

    /**
     * Type of underlying network connection in use
     * (for example, "wifi", "cellular"). May be omitted if unknown.
     */
    readonly type?: NetworkInformationType

    addEventListener<K extends keyof NetworkInformationEventMap>(
        type: K,
        listener: (
            this: NetworkInformation,
            ev: NetworkInformationEventMap[K]
        ) => any,
        options?: boolean | AddEventListenerOptions
    ): void

    removeEventListener<K extends keyof NetworkInformationEventMap>(
        type: K,
        listener: (
            this: NetworkInformation,
            ev: NetworkInformationEventMap[K]
        ) => any,
        options?: boolean | EventListenerOptions
    ): void
}

/**
 * Returns the browser's NetworkInformation interface, if it's defined.
 */
export function getNetworkInformation(): NetworkInformation | undefined {
    if (
        typeof window !== 'undefined' &&
        typeof window.navigator !== 'undefined' &&
        'connection' in window.navigator
    ) {
        return window.navigator.connection as NetworkInformation
    } else {
        return undefined
    }
}
