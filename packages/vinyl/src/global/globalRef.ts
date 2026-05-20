/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    getNetworkMetrics,
    getUserAgentInfo,
    globalRef,
    historyLogHandler,
    toDisposable,
} from '@amazon/vinyl-util'
import { playerRegistryRef } from './PlayerRegistry'
import { vinylVersion } from './environment'

declare global {
    /**
     * A reference to Vinyl's global state, easily accessible via console.
     */
    // eslint-disable-next-line no-var
    var vinylGlobal: any
}

/**
 * For console debugging, gives access to currently active players, logs, and client information.
 */
export class VinylGlobal {
    get players() {
        return playerRegistryRef.value.players
    }

    /**
     * Returns the first player.
     */
    get player() {
        return playerRegistryRef.value.players[0]
    }

    get logs() {
        return historyLogHandler.value?.history
    }

    get version() {
        return vinylVersion.str
    }

    get userAgentInfo() {
        return getUserAgentInfo()
    }

    get network() {
        return getNetworkMetrics()
    }

    /**
     * Returns the EWMA low estimate for the client's current bandwidth.
     */
    get bandwidth() {
        return this.network.estimatedDownlinkBandwidth.ewmaLow
    }
}

/**
 * Set the global vinylGlobal reference for easier console debugging.
 * Intentionally typed as AnyRecord to prevent API usage from code. This is
 * intended only for console debugging and the API may change at any time.
 */
export const vinylGlobalRef = globalRef((): AnyRecord => {
    global.vinylGlobal = new VinylGlobal()
    return toDisposable(() => {
        delete global.vinylGlobal
    })
})
