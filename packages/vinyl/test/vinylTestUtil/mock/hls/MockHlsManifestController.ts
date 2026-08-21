/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type {
    HlsManifestController,
    HlsManifestData,
    ManifestControllerEventMap,
} from '@amazon/vinyl'
import {
    type EventHandler,
    EventHostImpl,
    type SignalOptions,
} from '@amazon/vinyl-util'
import { data } from '@amazon/vinyl-observable'
import { mockHlsManifestData } from './mockHlsManifest'

const spyFactory = createSpyFactory<HlsManifestController>()

/**
 * Mock implementation of HlsManifestController.
 *
 * Uses a real MutableValue internally so that map/pick/onData work correctly.
 */
export class MockHlsManifestController implements HlsManifestController {
    private readonly _data = data<Promise<HlsManifestData>>(
        Promise.resolve(mockHlsManifestData)
    )
    private readonly events = new EventHostImpl<ManifestControllerEventMap>()

    refresh = spyFactory('refresh')
    reset = spyFactory('reset')

    on<K extends keyof ManifestControllerEventMap>(
        type: K,
        handler: EventHandler<ManifestControllerEventMap[K]>,
        options?: SignalOptions
    ) {
        return this.events.on(type, handler, options)
    }

    hasAnyListeners() {
        return this.events.hasAnyListeners()
    }

    hasListeners(type: keyof ManifestControllerEventMap) {
        return this.events.hasListeners(type)
    }

    readonly __eventMapType = this.events.__eventMapType

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
            value: Promise<HlsManifestData>,
            previous: Promise<HlsManifestData> | undefined
        ) => void
    ) {
        return this._data.onData(callback)
    }

    map<U>(transform: (value: Promise<HlsManifestData>) => U) {
        return this._data.map(transform)
    }

    pick<K extends keyof NonNullable<Promise<HlsManifestData>>>(prop: K) {
        return this._data.pick(prop)
    }

    setManifest(manifest: Promise<HlsManifestData>) {
        this._data.value = manifest
    }
}
