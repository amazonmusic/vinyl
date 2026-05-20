/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data } from '@amazon/vinyl-observable'
import { createAbortSlot, createDisposer, logDebug } from '@amazon/vinyl-util'
import type {
    DashManifestData,
    DashManifestProvider,
} from '@/track/dash/DashManifestProvider'
import type { ManifestController } from '@/streaming/ManifestController'

export type DashManifestController = ManifestController<
    Promise<DashManifestData>
>

export interface DashManifestControllerImplDeps {
    /**
     * Resolves the untransformed manifest.
     */
    readonly manifestProvider: DashManifestProvider
}

export class DashManifestControllerImpl implements DashManifestController {
    get [Symbol.toStringTag](): string {
        return 'DashManifestControllerImpl'
    }

    get logPrefix(): string {
        return 'DashManifestControllerImpl'
    }

    private readonly _data = data<Promise<DashManifestData>>(
        Promise.reject(new Error('manifest not loaded'))
    )
    private _error: Error | null = null
    private readonly abortSlot = createAbortSlot()
    private readonly disposer = createDisposer()

    constructor(readonly deps: DashManifestControllerImplDeps) {
        // Suppress unhandled rejection on the initial placeholder.
        this._data.value.catch(() => {})
        this.refresh()
    }

    /**
     * The most recent error from the manifest provider, or null.
     * This may be a silent error, such as an AbortError.
     */
    get error(): Error | null {
        return this._error
    }

    /**
     * Reloads the manifest. Aborts any in-flight request and clears any
     * previous error before starting a new fetch.
     */
    refresh() {
        logDebug(this, 'refresh')
        this.abort()
        this._error = null
        const promise = this.deps.manifestProvider(this.abortSlot.value)
        promise.catch((error: Error) => {
            this._error = error
        })
        this._data.value = promise
    }

    /**
     * If the manifest is in an error state, triggers a refresh.
     */
    reset() {
        logDebug(this, 'reset')
        if (this._error) {
            this.refresh()
        }
    }

    get value() {
        return this._data.value
    }

    get changeId() {
        return this._data.changeId
    }

    getValue() {
        return this._data.getValue()
    }

    onData(
        callback: (
            value: Promise<DashManifestData>,
            previous: Promise<DashManifestData> | undefined
        ) => void
    ) {
        return this._data.onData(callback)
    }

    map<U>(transform: (value: Promise<DashManifestData>) => U) {
        return this._data.map(transform)
    }

    pick<K extends keyof NonNullable<Promise<DashManifestData>>>(prop: K) {
        return this._data.pick(prop)
    }

    private abort() {
        this.abortSlot.abort()
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose() {
        this.abort()
        this.disposer.dispose()
    }
}
