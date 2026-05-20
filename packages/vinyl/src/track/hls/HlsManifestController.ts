/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data } from '@amazon/vinyl-observable'
import { createAbortSlot, createDisposer, logDebug } from '@amazon/vinyl-util'
import type { ManifestController } from '../../streaming/ManifestController'
import type {
    HlsManifestData,
    HlsManifestProvider,
} from './HlsManifestProvider'

export type HlsManifestController = ManifestController<Promise<HlsManifestData>>

export class HlsManifestControllerImpl implements HlsManifestController {
    get [Symbol.toStringTag](): string {
        return 'HlsManifestControllerImpl'
    }

    get logPrefix(): string {
        return 'HlsManifestControllerImpl'
    }

    private readonly _data = data<Promise<HlsManifestData>>(
        Promise.reject(new Error('manifest not loaded'))
    )
    private _error: Error | null = null
    private readonly abortSlot = createAbortSlot()
    private readonly disposer = createDisposer()

    constructor(private readonly manifestProvider: HlsManifestProvider) {
        // Suppress unhandled rejection on the initial placeholder.
        this._data.value.catch(() => {})
        this.refresh()
    }

    /**
     * The most recent error from the manifest provider, or null.
     */
    get error(): Error | null {
        return this._error
    }

    refresh(): void {
        logDebug(this, 'refresh')
        this.abortSlot.abort()
        this._error = null
        const promise = this.manifestProvider(this.abortSlot.value)
        promise.catch((error: Error) => {
            this._error = error
        })
        this._data.value = promise
    }

    reset(): void {
        logDebug(this, 'reset')
        if (this._error) {
            this.refresh()
        }
    }

    get value(): Promise<HlsManifestData> {
        return this._data.value
    }

    get changeId(): number {
        return this._data.changeId
    }

    getValue(): Promise<HlsManifestData> {
        return this._data.getValue()
    }

    onData(
        callback: (
            value: Promise<HlsManifestData>,
            previous?: Promise<HlsManifestData>
        ) => void
    ): () => void {
        return this._data.onData(callback)
    }

    map<U>(fn: (value: Promise<HlsManifestData>) => U) {
        return this._data.map(fn)
    }

    pick<K extends keyof NonNullable<Promise<HlsManifestData>>>(key: K) {
        return this._data.pick(key)
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose(): void {
        this.abortSlot.abort()
        this.disposer.dispose()
    }
}
