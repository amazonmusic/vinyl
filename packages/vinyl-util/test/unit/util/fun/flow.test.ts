/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { flow, flowRight, flowAsync, flowRightAsync } from '@amazon/vinyl-util'

describe('flow', () => {
    it('composes functions left to right', () => {
        const add1 = (x: number) => x + 1
        const multiply2 = (x: number) => x * 2
        const composed = flow(add1, multiply2)

        expect(composed(5)).toBe(12) // (5 + 1) * 2
    })

    it('works with single function', () => {
        const add1 = (x: number) => x + 1
        const composed = flow(add1)

        expect(composed(5)).toBe(6)
    })

    it('works with three functions', () => {
        const add1 = (x: number) => x + 1
        const multiply2 = (x: number) => x * 2
        const subtract3 = (x: number) => x - 3
        const composed = flow(add1, multiply2, subtract3)

        expect(composed(5)).toBe(9) // ((5 + 1) * 2) - 3
    })
})

describe('flowRight', () => {
    it('composes functions right to left', () => {
        const add1 = (x: number) => x + 1
        const multiply2 = (x: number) => x * 2
        const composed = flowRight(multiply2, add1)

        expect(composed(5)).toBe(12) // (5 + 1) * 2
    })

    it('works with single function', () => {
        const add1 = (x: number) => x + 1
        const composed = flowRight(add1)

        expect(composed(5)).toBe(6)
    })

    it('works with three functions', () => {
        const add1 = (x: number) => x + 1
        const multiply2 = (x: number) => x * 2
        const subtract3 = (x: number) => x - 3
        const composed = flowRight(subtract3, multiply2, add1)

        expect(composed(5)).toBe(9) // ((5 + 1) * 2) - 3
    })
})

describe('flowAsync', () => {
    it('composes async functions left to right', async () => {
        const add1 = (x: number) => Promise.resolve(x + 1)
        const multiply2 = (x: number) => Promise.resolve(x * 2)
        const composed = flowAsync(add1, multiply2)

        const result = await composed(5)
        expect(result).toBe(12) // (5 + 1) * 2
    })

    it('works with sync and async functions mixed', async () => {
        const add1 = (x: number) => x + 1 // sync
        const multiply2 = (x: number) => Promise.resolve(x * 2) // async
        const composed = flowAsync(add1, multiply2)

        const result = await composed(5)
        expect(result).toBe(12)
    })

    it('works with single function', async () => {
        const add1 = (x: number) => Promise.resolve(x + 1)
        const composed = flowAsync(add1)

        const result = await composed(5)
        expect(result).toBe(6)
    })

    it('handles errors properly', async () => {
        const throwError = (): Promise<never> => {
            return Promise.reject(new Error('test error'))
        }
        const add1 = (x: number) => x + 1
        const composed = flowAsync(add1, throwError)

        try {
            await composed(5)
            fail('Expected error to be thrown')
        } catch (error) {
            expect(error).toEqual(jasmine.any(Error))
            expect((error as Error).message).toBe('test error')
        }
    })
})

describe('flowRightAsync', () => {
    it('composes async functions right to left', async () => {
        const add1 = (x: number) => Promise.resolve(x + 1)
        const multiply2 = (x: number) => Promise.resolve(x * 2)
        const composed = flowRightAsync(multiply2, add1)

        const result = await composed(5)
        expect(result).toBe(12) // (5 + 1) * 2
    })

    it('works with sync and async functions mixed', async () => {
        const add1 = (x: number) => x + 1 // sync
        const multiply2 = (x: number) => Promise.resolve(x * 2) // async
        const composed = flowRightAsync(multiply2, add1)

        const result = await composed(5)
        expect(result).toBe(12)
    })

    it('works with single function', async () => {
        const add1 = (x: number) => Promise.resolve(x + 1)
        const composed = flowRightAsync(add1)

        const result = await composed(5)
        expect(result).toBe(6)
    })

    it('handles errors properly', async () => {
        const throwError = (): Promise<never> => {
            return Promise.reject(new Error('test error'))
        }
        const add1 = (x: number) => x + 1
        const composed = flowRightAsync(throwError, add1)

        try {
            await composed(5)
            fail('Expected error to be thrown')
        } catch (error) {
            expect(error).toEqual(jasmine.any(Error))
            expect((error as Error).message).toBe('test error')
        }
    })
})
