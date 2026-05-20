/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { vinylGlobalRef } from '@amazon/vinyl'
import { historyLogHandler } from '@amazon/vinyl-util'
import { overrideGlobalInit } from '@amazon/vinyl-util/testUtil'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('vinylGlobalRef', () => {
    beforeEach(() => {
        vinylGlobalRef.initialize()
    })

    describe('after initialization', () => {
        it('creates a vinylGlobal reference', () => {
            expect(vinylGlobalRef.value).toBeDefined()
            expect(global.vinylGlobal).toEqual(
                objectContaining({
                    players: any(Array),
                    player: undefined,
                    logs: any(Array),
                    version: any(String),
                    userAgentInfo: any(Object),
                    network: any(Object),
                    bandwidth: any(Number),
                })
            )
        })
    })

    describe('when historyLogHandler is undefined', () => {
        overrideGlobalInit(historyLogHandler, () => undefined)

        it('returns null logs', () => {
            expect(global.vinylGlobal).toEqual(
                objectContaining({
                    logs: undefined,
                })
            )
        })
    })

    describe('when reset', () => {
        it('clears the global reference', () => {
            expect(global.vinylGlobal).toBeDefined()
            vinylGlobalRef.reset()
            expect(global.vinylGlobal).toBeUndefined()
        })
    })
})
