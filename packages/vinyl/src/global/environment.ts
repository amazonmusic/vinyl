/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseVersion } from '@amazon/vinyl-util'

declare global {
    var __VINYL_VERSION__: string | undefined
}

/**
 * `globalThis.__VINYL_VERSION__` is replaced at build time with the package.version via
 * esbuild's `define` option. In unit tests and unbundled dev builds the replacement does not
 * happen and the global is undefined, so we fall through to a placeholder version.
 */
export const vinylVersion = parseVersion(
    /* istanbul ignore next */
    globalThis.__VINYL_VERSION__ ?? '0.0.0.0'
)
