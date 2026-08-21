/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data, type MutableValue } from '@amazon/vinyl-observable'
import {
    createAbortSlot,
    createDisposer,
    type EventHandler,
    EventHostImpl,
    logDebug,
    type SignalOptions,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type {
    ManifestController,
    ManifestControllerEventMap,
    ManifestProvider,
} from './ManifestController'

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
    private readonly events = new EventHostImpl<ManifestControllerEventMap>()
    private manifestSpanArmed = true

    constructor(private readonly deps: ManifestControllerImplDeps<T>) {
        // Kick off the initial manifest request. requestManifest() attaches its
        // own rejection handler, so the stored promise never rejects unhandled.
        this._data = data(this.requestManifest())
    }

    on<K extends keyof ManifestControllerEventMap>(
        type: K,
        handler: EventHandler<ManifestControllerEventMap[K]>,
        options?: SignalOptions
    ): Unsubscribe {
        return this.events.on(type, handler, options)
    }

    hasAnyListeners(): boolean {
        return this.events.hasAnyListeners()
    }

    hasListeners(type: keyof ManifestControllerEventMap): boolean {
        return this.events.hasListeners(type)
    }

    readonly __eventMapType = this.events.__eventMapType

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
        this.measureLoadSpan(promise)
        promise.catch((error: Error) => {
            this._error = error
        })
        return promise
    }

    /**
     * Measures the initial manifest fetch as a load span, re-arming on failure
     * so a recovered load is still measured.
     */
    private measureLoadSpan(promise: Promise<T>): void {
        if (!this.manifestSpanArmed) return
        this.manifestSpanArmed = false
        const startTime = Date.now()
        promise.then(
            () =>
                this.events.dispatch('loadSpanMeasured', {
                    kind: 'manifest',
                    startTime,
                    endTime: Date.now(),
                }),
            () => (this.manifestSpanArmed = true)
        )
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
        this.events.dispose()
    }
}
