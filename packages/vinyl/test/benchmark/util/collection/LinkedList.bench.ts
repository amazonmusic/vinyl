/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { LinkedList } from '@amazon/vinyl-util'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { addBenchmarks, setupBenchmark } from '@/setup'

describe('LinkedList', () => {
    setupBenchmark()

    interface Element {
        r: number
        a: number
        b: number
    }

    function createList(n: number): LinkedList<Element> {
        const list = new LinkedList<Element>()
        for (let i = 0; i < n; i++) {
            list.push({ r: 0, a: Math.random(), b: Math.random() })
        }
        return list
    }

    function createArray(n: number) {
        const arr: Element[] = []
        for (let i = 0; i < n; i++) {
            arr.push({ r: 0, a: Math.random(), b: Math.random() })
        }
        return arr
    }

    ;[100, 1000].forEach((size) => {
        const list = createList(size)
        const arr = createArray(size)

        describe(`size: ${size}`, () => {
            it('forEach', async () => {
                const name = `forEach ${size}`
                // Having an unpredictable output in the executor prevents the JS engine from
                // any potential caching.
                const listResults = await benchmark(
                    `LinkedList ${name}`,
                    () => {
                        list.forEach((e: Element) => (e.r = e.a + e.b))
                    }
                )
                const arrayResults = await benchmark(`Array ${name}`, () => {
                    arr.forEach((e) => (e.r = e.a + e.b))
                })
                addBenchmarks(name, listResults, arrayResults)
            })

            it('unshift', async () => {
                const name = `unshift/shift ${size}`
                const e = { r: 0, a: 0, b: 0 }
                const listResults = await benchmark(
                    `LinkedList ${name}`,
                    () => {
                        list.unshift(e)
                        list.shift()
                    }
                )
                const arrayResults = await benchmark(`Array ${name}`, () => {
                    arr.unshift(e)
                    arr.shift()
                })
                addBenchmarks(name, listResults, arrayResults)
            })

            it('push', async () => {
                const name = `push/pop ${size}`
                const e = { r: 0, a: 0, b: 0 }
                const listResults = await benchmark(
                    `LinkedList ${name}`,
                    () => {
                        list.push(e)
                        list.pop()
                    }
                )
                const arrayResults = await benchmark(`Array ${name}`, () => {
                    arr.push(e)
                    arr.pop()
                })
                addBenchmarks(name, listResults, arrayResults)
            })

            it('for of', async () => {
                const name = `for of ${size}`
                const listResults = await benchmark(
                    `LinkedList ${name}`,
                    () => {
                        for (const e of list) {
                            e.r = e.a + e.b
                        }
                    }
                )
                const arrayResults = await benchmark(`Array ${name}`, () => {
                    for (const e of arr) {
                        e.r = e.a + e.b
                    }
                })
                addBenchmarks(name, listResults, arrayResults)
            })
        })
    })
})
