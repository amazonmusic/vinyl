/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { memoize } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('memoize', () => {
    describe('when there is not a key provider', () => {
        it('caches the result', () => {
            const s = createSpy().and.returnValue(42)
            const c = memoize(s)
            expect(s).not.toHaveBeenCalled()
            expect(c()).toBe(42)
            expect(c()).toBe(42)
            expect(c()).toBe(42)
            expect(s).toHaveBeenCalledTimes(1)
        })

        describe('clear', () => {
            it('clears cached values', () => {
                const s = createSpy().and.returnValue(42)
                const c = memoize(s)
                expect(s).not.toHaveBeenCalled()
                expect(c()).toBe(42)
                c.clear()
                expect(c()).toBe(42)
                expect(s).toHaveBeenCalledTimes(2)
                expect(c()).toBe(42)
                expect(s).toHaveBeenCalledTimes(2)
                c.clear()
                expect(c()).toBe(42)
                expect(s).toHaveBeenCalledTimes(3)
                expect(c()).toBe(42)
                expect(s).toHaveBeenCalledTimes(3)
            })
        })
    })

    describe('when there is a key provider', () => {
        it('caches the result based on the key from the key provider', () => {
            const spy = createSpy()
            const c = memoize(
                (arg1: string, arg2: number) => {
                    spy(arg1, arg2)
                    return `${arg1}${arg2}`
                },
                (arg1: string, arg2: number) => `${arg1}${arg2}`
            )
            expect(spy).not.toHaveBeenCalled()
            expect(c('a', 1)).toBe('a1')
            expect(c('a', 1)).toBe('a1')
            expect(c('a', 1)).toBe('a1')
            expect(spy).toHaveBeenCalledTimes(1)
            spy.calls.reset()
            expect(c('a', 2)).toBe('a2')
            expect(c('a', 3)).toBe('a3')
            expect(c('a', 2)).toBe('a2')
            expect(c('b', 1)).toBe('b1')
            expect(c('b', 1)).toBe('b1')
            expect(c('a', 2)).toBe('a2')
            expect(c('a', 3)).toBe('a3')
            expect(spy).toHaveBeenCalledTimes(3)
        })

        describe('clear', () => {
            it('clears cached values', () => {
                const spy = createSpy()
                const c = memoize(
                    (arg1: string, arg2: number) => {
                        spy(arg1, arg2)
                        return arg1 + arg2.toString()
                    },
                    (arg1: string, arg2: number) => `${arg1}${arg2}`
                )
                expect(spy).not.toHaveBeenCalled()
                expect(c('a', 1)).toBe('a1')
                expect(c('b', 2)).toBe('b2')
                spy.calls.reset()
                c.clear()
                expect(c('a', 1)).toBe('a1')
                expect(spy).toHaveBeenCalledOnceWith('a', 1)
                spy.calls.reset()
                expect(c('b', 2)).toBe('b2')
                expect(spy).toHaveBeenCalledOnceWith('b', 2)
            })
        })

        describe('and a capacity is provided', () => {
            it('memoizes the last recently used n results', () => {
                const spy = createSpy()
                const c = memoize(spy, (arg) => arg, 2)
                c('a')
                c('b')
                expect(spy).toHaveBeenCalledTimes(2)
                c('a') // cached
                c('b') // cached
                expect(spy).toHaveBeenCalledTimes(2)
                c('c') // at capacity, kicks least recently used 'a' out of the cache
                expect(spy).toHaveBeenCalledTimes(3)
                c('a')
                expect(spy).toHaveBeenCalledTimes(4)
            })

            describe('when capacity is 0', () => {
                it('never caches results', () => {
                    const spy = createSpy().and.returnValue('result')
                    const c = memoize(spy, (arg) => arg, 0)
                    expect(c('a')).toBe('result')
                    expect(c('a')).toBe('result')
                    expect(c('a')).toBe('result')
                    expect(spy).toHaveBeenCalledTimes(3)
                })

                it('clear does nothing', () => {
                    const spy = createSpy().and.returnValue('result')
                    const c = memoize(spy, (arg) => arg, 0)
                    c('a')
                    c.clear()
                    c('a')
                    expect(spy).toHaveBeenCalledTimes(2)
                })
            })

            describe('when capacity is 1', () => {
                it('caches only the most recent result', () => {
                    const spy = createSpy()
                    const c = memoize(spy, (arg) => arg, 1)
                    c('a')
                    c('a') // cached
                    expect(spy).toHaveBeenCalledTimes(1)
                    c('b') // replaces 'a' in cache
                    expect(spy).toHaveBeenCalledTimes(2)
                    c('b') // cached
                    expect(spy).toHaveBeenCalledTimes(2)
                    c('a') // not cached anymore
                    expect(spy).toHaveBeenCalledTimes(3)
                })

                it('clear resets the cache', () => {
                    const spy = createSpy()
                    const c = memoize(spy, (arg) => arg, 1)
                    c('a')
                    c('a') // cached
                    expect(spy).toHaveBeenCalledTimes(1)
                    c.clear()
                    c('a') // not cached after clear
                    expect(spy).toHaveBeenCalledTimes(2)
                })
            })
        })
    })
})
