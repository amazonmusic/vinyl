/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data, type MutableValue } from '@amazon/vinyl-observable'
import { createAbortSlot, createDisposer, logDebug } from '@amazon/vinyl-util'
import type { ManifestController, ManifestProvider } from './ManifestController'

export interface ManifestControllerImplDeps<T> {
    readonly manifestProvider: ManifestProvider<T>
}

export class ManifestControllerImpl<T> implements ManifestController<
    Promise<T>
> {
    get [Symbol.toStringTag](): string {
        return 'ManifestControllerImpl'
    }

    get logPrefix(): string {
        return 'ManifestControllerImpl'
    }

    private readonly _data: MutableValue<Promise<T>>
    private _error: Error | null = null
    private readonly abortSlot = createAbortSlot()
    private readonly disposer = createDisposer()

    constructor(private readonly deps: ManifestControllerImplDeps<T>) {
        // Kick off the initial manifest request. requestManifest() attaches its
        // own rejection handler, so the stored promise never rejects unhandled.
        this._data = data(this.requestManifest())
    }

    /**
     * The most recent error from the manifest provider, or null.
     */
    get error(): Error | null {
        return this._error
    }

    refresh(): void {
        logDebug(this, 'refresh')
        this._data.value = this.requestManifest()
    }

    private requestManifest(): Promise<T> {
        this.abortSlot.abort()
        this._error = null
        const promise = this.deps.manifestProvider(this.abortSlot.value)
        promise.catch((error: Error) => {
            this._error = error
        })
        return promise
    }

    reset(): void {
        logDebug(this, 'reset')
        if (this._error) {
            this.refresh()
        }
    }

    get value(): Promise<T> {
        return this._data.value
    }

    get changeId(): number {
        return this._data.changeId
    }

    getValue(): Promise<T> {
        return this._data.getValue()
    }

    onData(
        callback: (value: Promise<T>, previous?: Promise<T>) => void
    ): () => void {
        return this._data.onData(callback)
    }

    map<U>(fn: (value: Promise<T>) => U) {
        return this._data.map(fn)
    }

    pick<K extends keyof NonNullable<Promise<T>>>(key: K) {
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
