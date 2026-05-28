/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DomEventHost } from '../event/DomEventHost'
import type { ReadonlyEventHost } from '../event/EventHost'
import { nextEventAsPromise } from '../event/nextEventAsPromise'
import { globalRef } from '../global/globalRegistry'
import type { ReadonlyAbort } from '../util/async/Abort'
import type { Maybe } from '../util/type'

export type DomEventTarget = EventTarget

export interface NetworkStateEventMap {
    readonly offline: Event
    readonly online: Event
}

/**
 * Online status.
 */
export interface NetworkState extends ReadonlyEventHost<NetworkStateEventMap> {
    /**
     * Returns the online status of the browser.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
     */
    readonly onLine: boolean

    /**
     * Returns a promise that resolves when the network state is next online.
     * Rejects immediately if the given `abortSignal` is in an aborted state.
     * Resolves immediately if the navigator is currently online.
     * @param abort If provided, rejects the returned promise when aborted.
     */
    nextOnLine(abort?: Maybe<ReadonlyAbort>): Promise<void>
}

export interface NetworkStateImplDeps {
    readonly eventTarget: DomEventTarget
    readonly navigator: { readonly onLine: boolean }
}

export class NetworkStateImpl
    extends DomEventHost<NetworkStateEventMap>
    implements NetworkState
{
    static createDefaultDeps(): NetworkStateImplDeps {
        if (typeof window === 'undefined') {
            return {
                eventTarget: {
                    addEventListener() {},
                    removeEventListener() {},
                    dispatchEvent() {
                        return true
                    },
                },
                navigator: {
                    onLine: true,
                },
            }
        }
        return {
            eventTarget: window,
            navigator: window.navigator,
        }
    }

    constructor(
        protected readonly deps: NetworkStateImplDeps = NetworkStateImpl.createDefaultDeps()
    ) {
        super(deps.eventTarget)
    }

    get onLine(): boolean {
        return this.deps.navigator.onLine
    }

    nextOnLine(abort?: Maybe<ReadonlyAbort>): Promise<void> {
        if (abort?.aborted()) return Promise.reject(abort.reason!)
        if (this.onLine) return Promise.resolve()
        return nextEventAsPromise<NetworkStateEventMap, 'online'>(
            this,
            'online',
            { abort }
        ).then(() => void 0)
    }
}

/**
 * A global reference to the network state.
 */
export const networkState = globalRef<NetworkState>(
    () => new NetworkStateImpl()
)

export function getNetworkState(): NetworkState {
    return networkState.value
}

export function onLine(): boolean {
    return networkState.value.onLine
}
