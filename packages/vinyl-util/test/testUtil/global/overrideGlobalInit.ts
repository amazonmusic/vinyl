/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GlobalRef } from '@amazon/vinyl-util'

export function overrideGlobalInit<T, U extends T>(
    initHandle: GlobalRef<T>,
    initOverride: () => U
): { readonly value: U } {
    beforeEach(() => {
        initHandle.set(initOverride)
    })
    return initHandle as GlobalRef<U>
}
