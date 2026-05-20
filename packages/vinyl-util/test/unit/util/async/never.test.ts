/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { never } from '@amazon/vinyl-util'

describe('never', () => {
    it('never resolves', async () => {
        await expectAsync(never).toBePending()
    })

    describe('then', () => {
        it('returns never', () => {
            expect(never.then()).toBe(never)
        })
    })
    describe('catch', () => {
        it('returns never', () => {
            expect(never.catch()).toBe(never)
        })
    })

    describe('finally', () => {
        it('returns never', () => {
            expect(never.finally()).toBe(never)
        })
    })

    describe('Symbol.toStringTag', () => {
        it('returns Never', () => {
            expect(never[Symbol.toStringTag]).toEqual('Never')
        })
    })
})
