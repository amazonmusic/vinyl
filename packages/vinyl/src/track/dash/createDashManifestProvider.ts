/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashTrackLoadOptions } from './DashTrack'
import { urlDashManifestProvider } from './urlDashManifestProvider'
import type { DashManifestProvider } from './DashManifestProvider'
import { resolveDashRemoteElements } from './resolveDashRemoteElements'
import type { RequestInterceptor } from '@amazon/vinyl-util'

/**
 * Creates a DashManifestProvider which uses the manifestProvider set on the loadOptions, or a urlDashManifestProvider
 * if unset, which will use the loadOptions.uri as the manifest location. Linked Periods and remote (XLink) elements of
 * the provided manifest are resolved (see {@link resolveDashRemoteElements}).
 *
 * @param loadOptions
 */
export function createDashManifestProvider(loadOptions: DashTrackLoadOptions) {
    return (deps: {
        readonly requestInterceptor: RequestInterceptor
    }): DashManifestProvider => {
        const provider =
            loadOptions.manifestProvider ??
            urlDashManifestProvider(
                loadOptions.uri,
                loadOptions.requestInit,
                deps.requestInterceptor
            )
        return async (abort) =>
            resolveDashRemoteElements(
                {
                    requestInterceptor: deps.requestInterceptor,
                    requestInit: loadOptions.requestInit,
                },
                await provider(abort),
                abort
            )
    }
}
