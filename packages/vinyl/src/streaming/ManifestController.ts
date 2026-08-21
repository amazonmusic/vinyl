/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import type { ReadonlyAbort, ReadonlyEventHost } from '@amazon/vinyl-util'
import type { LoadSpanMeasurement } from './LoadMetric'

/**
 * Events a manifest controller dispatches.
 */
export interface ManifestControllerEventMap {
    /**
     * The initial manifest fetch completed.
     */
    readonly loadSpanMeasured: LoadSpanMeasurement
}

export interface ManifestController<T>
    extends ObservableValue<T>, ReadonlyEventHost<ManifestControllerEventMap> {
    /**
     * Manually triggers a reload of the manifest.
     * A manifest reload will not clear currently fetched or buffered segments.
     */
    refresh(): void

    /**
     * If the manifest promise has rejected, refresh.
     */
    reset(): void
}

/**
 * Provides a manifest.
 */
export type ManifestProvider<T> = (abort?: ReadonlyAbort) => Promise<T>
