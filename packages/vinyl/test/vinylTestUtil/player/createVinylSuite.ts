/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylPlayer,
    type VinylDependencyOptions,
    type VinylPlayer,
} from '@amazon/vinyl'
import type { Unsubscribe } from '@amazon/vinyl-util'
import {
    createLogPrefix,
    getGlobalRegistry,
    IllegalStateError,
    logDebug,
} from '@amazon/vinyl-util'
import { setTestTimeout } from '@amazon/vinyl-util/browserTestUtil'
import { mediaRef } from '@/player/mediaRef'

export interface VinylSuiteOptions {
    /**
     * The number of seconds before the tests in this suite time out.
     * Default is 60s.
     */
    readonly timeout?: number

    /**
     * If true, will fail the test on error events.
     * default: true
     */
    readonly failOnError?: boolean
}

export class VinylSuite<T extends VinylPlayer<any, any> = VinylPlayer> {
    get [Symbol.toStringTag](): string {
        return 'VinylSuite'
    }
    readonly logPrefix = createLogPrefix(this)

    private _player: T | null = null

    get player(): T {
        if (!this._player)
            throw new IllegalStateError(
                'player cannot be accessed outside of a test'
            )
        return this._player
    }

    private readonly visibilityChangeHandler = () => {
        if (document.visibilityState === 'hidden') {
            fail('The window must remain visible during the tests.')
        }
    }

    constructor(
        /**
         * Constructs a new player.
         */
        private readonly playerFactory: () => T,
        protected readonly options?: VinylSuiteOptions
    ) {}

    /**
     * Initializes jasmine test setup.
     */
    init() {
        let playerErrorSub: Unsubscribe | null = null
        setTestTimeout(this.options?.timeout ?? 60)
        beforeEach(() => {
            document.addEventListener(
                'visibilitychange',
                this.visibilityChangeHandler
            )
            this._player = this.playerFactory()
            if (this.options?.failOnError !== false) {
                playerErrorSub = this._player.on('error', (e) => {
                    fail(e)
                })
            }
        })

        afterEach(() => {
            logDebug(this, 'disposing')
            if (playerErrorSub) playerErrorSub()
            this._player?.dispose()
            this._player = null
            document.removeEventListener(
                'visibilitychange',
                this.visibilityChangeHandler
            )
            getGlobalRegistry().reset()
        })
    }
}

/**
 * Prepares an integration test for a Vinyl Player.
 * This will create a player, handle disposal and global cleanup, and watch for window
 * visibility changes, which can interfere with test results.
 */
export function createVinylSuite(
    playerDependencyOptions?: Partial<VinylDependencyOptions>,
    options?: VinylSuiteOptions
): VinylSuite {
    const suite = new VinylSuite(() => {
        return createVinylPlayer({
            ...playerDependencyOptions,
            media: mediaRef.value,
        })
    }, options)
    suite.init()
    return suite
}
