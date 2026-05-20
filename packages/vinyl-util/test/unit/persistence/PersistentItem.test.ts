/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createPersistentItem,
    persistenceRef,
    PersistentItemImpl,
} from '@amazon/vinyl-util'
import {
    MockPersistence,
    overrideGlobalInit,
    useMockLogger,
} from '@amazon/vinyl-util/testUtil'
import any = jasmine.any
import createSpy = jasmine.createSpy

describe('PersistentItem', () => {
    const loggerRef = useMockLogger()
    const persistenceGlobalRef = overrideGlobalInit(
        persistenceRef,
        () => new MockPersistence()
    )
    let persistence: MockPersistence
    const key = 'testKey'

    beforeEach(() => {
        persistence = new MockPersistence()
    })

    describe('when persistence is not provided', () => {
        it('uses default persistenceRef', async () => {
            persistenceGlobalRef.value.get.and.resolveTo('"test"')
            const persistentItem = createPersistentItem({
                key,
                defaultValue: '',
            })
            await expectAsync(persistentItem.get()).toBeResolvedTo('test')
        })
    })

    describe('when persistence is a function', () => {
        it('invokes once on first use', async () => {
            const spy = createSpy('persistenceFactory').and.callFake(
                () => persistence
            )
            const persistentItem = createPersistentItem({
                key,
                defaultValue: '',
                persistence: spy,
            })
            expect(spy).not.toHaveBeenCalled()
            await persistentItem.get()
            expect(spy).toHaveBeenCalledTimes(1)
            await persistentItem.set('v')
            expect(spy).toHaveBeenCalledTimes(1)
        })
    })

    describe('get', () => {
        it('retrieves the default value when persistence returns null', async () => {
            const defaultValue = { test: 'default' }
            const persistentItem = createPersistentItem({
                key,
                defaultValue,
                persistence,
            })

            persistence.get.and.returnValue(Promise.resolve(null))

            const result = await persistentItem.get()

            expect(persistence.get).toHaveBeenCalledWith(key)
            expect(result).toEqual(defaultValue)
        })

        it('parses and returns the value from persistence', async () => {
            const persistentItem = createPersistentItem({
                key,
                defaultValue: {},
                persistence,
            })
            const storedValue = '{"test": "stored"}'
            persistence.get.and.returnValue(Promise.resolve(storedValue))

            const result = await persistentItem.get()

            expect(persistence.get).toHaveBeenCalledWith(key)
            expect(result).toEqual(JSON.parse(storedValue))
        })

        it('logs an error and returns the default value when parsing fails', async () => {
            const defaultValue = { test: 123 }
            const persistentItem = createPersistentItem({
                key,
                defaultValue,
                persistence,
            })
            const invalidValue = 'invalid_json'
            persistence.get.and.returnValue(Promise.resolve(invalidValue))

            const result = await persistentItem.get()

            expect(persistence.get).toHaveBeenCalledWith(key)
            expect(result).toEqual(defaultValue)
            expect(persistence.remove).toHaveBeenCalledWith(key)
            expect(loggerRef.value.error).toHaveBeenCalled()
        })

        describe('when given custom serialize and deserialize', () => {
            it('uses provided reviver', async () => {
                const persistentItem = createPersistentItem<
                    {
                        readonly test: string
                    },
                    string
                >({
                    key,
                    defaultValue: { test: 'test' },
                    deserialize: (str) => ({ test: str }),
                    serialize: (object) => `out: ${object.test}`,
                    persistence,
                })

                persistence.get.and.resolveTo('test123')
                await expectAsync(persistentItem.get()).toBeResolvedTo({
                    test: 'test123',
                })
                await persistentItem.set({ test: 'test456' })
                expect(persistence.set).toHaveBeenCalledOnceWith(
                    'testKey',
                    `out: test456`
                )
            })
        })
    })

    describe('set', () => {
        it('stores the value in persistence', async () => {
            const persistentItem = createPersistentItem({
                key,
                defaultValue: {},
                persistence,
            })
            const valueToStore = { test: 'value' }
            await persistentItem.set(valueToStore)

            expect(persistence.set).toHaveBeenCalledWith(
                key,
                JSON.stringify(valueToStore)
            )
        })

        describe('when given a custom stringify', () => {
            it('uses provided stringify', async () => {
                const persistentItem = createPersistentItem<{
                    readonly test: string
                }>({
                    key,
                    defaultValue: { test: 'test' },
                    serialize: (value) => value.test,
                    persistence,
                })

                await persistentItem.set({ test: 'test123' })
                expect(persistence.set).toHaveBeenCalledWith(key, 'test123')
            })
        })
    })

    describe('remove', () => {
        it('removes the item from persistence', async () => {
            const persistentItem = createPersistentItem({
                key,
                defaultValue: 1,
                persistence,
            })
            await persistentItem.remove()

            expect(persistence.remove).toHaveBeenCalledWith(key)
        })
    })

    describe('when validator is set', () => {
        it('validates the persisted value', async () => {
            const persistentItem = createPersistentItem<number>({
                key,
                defaultValue: -1,
                persistence,
                validator: (_input) => {
                    throw new Error('expected')
                },
            })
            persistence.get.and.returnValue(
                Promise.resolve(JSON.stringify('not a number'))
            )

            const result = await persistentItem.get()
            expect(result).toBe(-1)
            expect(persistence.remove).toHaveBeenCalledWith(key)
            expect(loggerRef.value.error).toHaveBeenCalledOnceWith(
                any(Object),
                'could not revive <testKey> from persistence',
                any(Error)
            )
        })
    })

    describe('createPersistentItem', () => {
        it('creates a new PersistentItem', () => {
            expect(
                createPersistentItem({
                    key: 'testKey',
                    defaultValue: { test: 'test' },
                    persistence,
                })
            ).toBeInstanceOf(PersistentItemImpl)
        })
    })
})

describe('PersistentItem', () => {
    overrideGlobalInit(persistenceRef, () => {
        throw new Error('should not be called')
    })

    it('does not use global registry during construction', () => {
        // Creating a PersistentItem should not reference the global registry until it's first used.
        expect(() =>
            createPersistentItem<string>({
                key: 'key',
                defaultValue: '',
            })
        ).not.toThrow()
    })
})
