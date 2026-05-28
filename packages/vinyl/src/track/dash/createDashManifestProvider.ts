/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashTrackLoadOptions } from './DashTrack'
import { urlDashManifestProvider } from './urlDashManifestProvider'
import type { RequestInterceptor } from '@amazon/vinyl-util'

/**
 * Creates a DashManifestProvider which uses the manifestProvider set on the loadOptions, or a urlDashManifestProvider
 * if unset, which will use the loadOptions.uri as the manifest location.
 *
 * @param loadOptions
 */
export function createDashManifestProvider(loadOptions: DashTrackLoadOptions) {
    return (deps: { readonly requestInterceptor: RequestInterceptor }) => {
        return loadOptions.manifestProvider
            ? loadOptions.manifestProvider
            : urlDashManifestProvider(
                  loadOptions.uri,
                  loadOptions.requestInit,
                  deps.requestInterceptor
              )
    }
}
