/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KeyValuePersistence } from './KeyValuePersistence'
import type { Maybe } from '../util/type'

export class StoragePersistence implements KeyValuePersistence<string> {
    constructor(private readonly storage: Maybe<Storage>) {}

    clear(): Promise<void> {
        this.storage?.clear()
        return Promise.resolve()
    }

    get(key: string): Promise<string | null> {
        return Promise.resolve(this.storage?.getItem(key) ?? null)
    }

    remove(key: string): Promise<void> {
        this.storage?.removeItem(key)
        return Promise.resolve()
    }

    set(key: string, value: string): Promise<void> {
        this.storage?.setItem(key, value)
        return Promise.resolve()
    }
}
