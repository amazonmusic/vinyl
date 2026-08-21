/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type {
    DashManifestController,
    DashManifestData,
    ManifestControllerEventMap,
} from '@amazon/vinyl'
import {
    type EventHandler,
    EventHostImpl,
    type SignalOptions,
} from '@amazon/vinyl-util'
import { data } from '@amazon/vinyl-observable'
import { mockDashManifest } from './mockDashManifest'

const spyFactory = createSpyFactory<DashManifestController>()

/**
 * Mock implementation of DashManifestController.
 *
 * Uses a real MutableValue internally so that map/pick/onData work correctly.
 */
export class MockDashManifestController implements DashManifestController {
    private readonly _data = data<Promise<DashManifestData>>(
        Promise.resolve({
            manifest: mockDashManifest,
            baseUrl: 'https://example.com',
        })
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

    dispatch<K extends keyof ManifestControllerEventMap>(
        type: K,
        event: ManifestControllerEventMap[K]
    ) {
        this.events.dispatch(type, event)
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

    setManifest(manifest: Promise<DashManifestData>) {
        this._data.value = manifest
    }
}
