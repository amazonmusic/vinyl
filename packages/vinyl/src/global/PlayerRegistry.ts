/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRecord, Disposable } from '@amazon/vinyl-util'
import {
    globalRef,
    globalTarget,
    IllegalStateError,
    logWarn,
    remove,
    substitute,
} from '@amazon/vinyl-util'

/**
 * @private
 */
const locale = {
    maxPlayersWarning: `{count} Vinyl Players have been constructed without disposal. Check that player.dispose is properly being called, then increase the maxPlayersWarning option if this was intentional.`,
} as const

/**
 * A registry of all non-disposed Vinyl players.
 * Used for debugging and cleanup validation.
 */
export interface PlayerRegistry {
    /**
     * Returns the non-disposed Vinyl players.
     */
    readonly players: readonly AnyRecord[]

    /**
     * Adds a player reference. All players must be removed before disposing VinylGlobal.
     *
     * @param player
     */
    addPlayer(player: AnyRecord): void

    /**
     * Removes a player reference.
     *
     * @param player
     */
    removePlayer(player: AnyRecord): void
}

export const DEFAULT_MAX_PLAYERS = 5

/**
 * A registry of non-disposed players.
 * Used for leak detection and debugging diagnostics.
 */
export class PlayerRegistryImpl implements PlayerRegistry, Disposable {
    private _players: AnyRecord[] = []

    private gaveMaxPlayersWarning = false

    constructor(
        /**
         * The number of concurrent players before a warning is logged.
         * default: 5
         */
        public maxPlayersWarning: number = DEFAULT_MAX_PLAYERS
    ) {}

    get players(): readonly AnyRecord[] {
        return this._players
    }

    addPlayer(player: AnyRecord): void {
        this._players.push(player)
        const n = this._players.length
        if (n > this.maxPlayersWarning && !this.gaveMaxPlayersWarning) {
            this.gaveMaxPlayersWarning = true
            logWarn(
                globalTarget,
                substitute(locale.maxPlayersWarning, { count: n })
            )
        }
    }

    removePlayer(player: AnyRecord): void {
        remove(this._players, player)
    }

    /**
     * @throws An IllegalStateError if all players have not been removed.
     */
    dispose() {
        if (this._players.length)
            throw new IllegalStateError(
                'All players must be removed before disposing VinylGlobal'
            )
    }
}

export const playerRegistryRef = globalRef<PlayerRegistry>(
    () => new PlayerRegistryImpl()
)
