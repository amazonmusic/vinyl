/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type { DashManifestController, DashManifestData } from '@amazon/vinyl'
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

    refresh = spyFactory('refresh')
    reset = spyFactory('reset')

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
