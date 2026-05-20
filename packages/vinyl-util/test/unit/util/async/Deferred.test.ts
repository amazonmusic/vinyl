/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Deferred } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('Deferred', () => {
    describe('resolve', () => {
        it('resolves the promise', async () => {
            const d = new Deferred<number>()
            await expectAsync(d).toBePending()
            d.resolve(42)
            await expectAsync(d).toBeResolvedTo(42)
        })
    })

    describe('reject', () => {
        it('resolves the promise', async () => {
            const d = new Deferred<number>()
            d.reject(42)
            await expectAsync(d).toBeRejectedWith(42)
        })
    })

    describe('catch', () => {
        it('returns a new promise', async () => {
            const d = new Deferred<number>()
            const promise = d.catch(() => Promise.resolve(42))
            d.reject(-1)
            await expectAsync(promise).toBeResolvedTo(42)
        })
    })

    describe('then', () => {
        it('returns a new promise', async () => {
            const d = new Deferred<number>()
            const promise = d.then(() => Promise.reject(new Error('42')))
            d.resolve(-1)
            await expectAsync(promise).toBeRejectedWithError('42')
        })
    })

    describe('finally', () => {
        it('returns a new promise', async () => {
            const d = new Deferred<number>()
            const spy = createSpy('finally')
            const promise = d.finally(spy)
            d.resolve(42)
            await expectAsync(promise).toBeResolvedTo(42)
            expect(spy).toHaveBeenCalledOnceWith()
        })
    })

    describe('Symbol.toStringTag', () => {
        it('returns a string', () => {
            expect(new Deferred()[Symbol.toStringTag]).toBeInstanceOf(String)
        })
    })
})
