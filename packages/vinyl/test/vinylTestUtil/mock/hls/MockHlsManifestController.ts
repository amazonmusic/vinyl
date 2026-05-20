/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type { HlsManifestController, HlsManifestData } from '@amazon/vinyl'
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
