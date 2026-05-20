/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { mergeDeep } from '@amazon/vinyl-util'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { addBenchmarks, setupBenchmark } from '@/setup'

describe('mergeDeep', () => {
    setupBenchmark()
    it('object merge', async () => {
        const a = {
            b: {
                c: 3,
                d: 4,
                e: 'test',
            },
            f: {
                g: 5,
                h: true,
                i: false,
            },
            j: {
                k: {
                    m: 5,
                },
            },
        }

        const b = {
            b: {
                d: 4,
                f2: 'test2',
            },
            f: {
                g: 5,
                h: true,
                i: false,
            },
            j: {
                k: {
                    m: 5,
                },
            },
        }

        const mergeDeepResults = await benchmark(`mergeDeep`, () => {
            mergeDeep([a, b])
        })
        addBenchmarks('merge deep', mergeDeepResults)
    })
})
