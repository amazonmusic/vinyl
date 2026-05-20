/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'

export interface ManifestController<T> extends ObservableValue<T> {
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
