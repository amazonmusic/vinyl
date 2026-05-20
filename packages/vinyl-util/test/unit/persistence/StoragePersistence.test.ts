/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoragePersistence } from '@amazon/vinyl-util'
import { MockStorage } from '@amazon/vinyl-util/browserTestUtil'

describe('StoragePersistence', () => {
    let persistence: StoragePersistence
    let storage: MockStorage

    beforeEach(() => {
        storage = new MockStorage()
        persistence = new StoragePersistence(storage)
    })

    describe('clear', () => {
        it('invokes storage.clear()', async () => {
            await persistence.clear()
            expect(storage.clear).toHaveBeenCalled()
        })
    })

    describe('get', () => {
        it('retrieves the value from storage for a given key', async () => {
            const key = 'testKey'
            const value = 'testValue'
            storage.getItem.and.returnValue(value)

            const result = await persistence.get(key)

            expect(storage.getItem).toHaveBeenCalledWith(key)
            expect(result).toBe(value)
        })

        it('returns null if the key does not exist', async () => {
            const key = 'missingKey'
            const result = await persistence.get(key)

            expect(storage.getItem).toHaveBeenCalledWith(key)
            expect(result).toBeNull()
        })
    })

    describe('remove', () => {
        it('deletes the item from storage for a given key', async () => {
            const key = 'testKey'
            await persistence.remove(key)

            expect(storage.removeItem).toHaveBeenCalledWith(key)
        })
    })

    describe('set', () => {
        it('stores the item in storage for a given key and value', async () => {
            const key = 'testKey'
            const value = 'testValue'
            await persistence.set(key, value)

            expect(storage.setItem).toHaveBeenCalledWith(key, value)
        })
    })
})
