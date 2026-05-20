/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalRef } from '@/global/globalRegistry'
import type { KeyValuePersistence } from '@/persistence/KeyValuePersistence'
import { StoragePersistence } from '@/persistence/StoragePersistence'

/**
 * The default storage persistence for simple key / value pairs.
 * This may be overridden, and by default resolves to local storage persistence.
 */
export const persistenceRef = globalRef<KeyValuePersistence<string>>(() => {
    return new StoragePersistence(
        typeof localStorage !== 'undefined' ? localStorage : null
    )
})
