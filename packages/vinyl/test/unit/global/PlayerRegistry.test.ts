/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerRegistryImpl } from '@amazon/vinyl'
import { globalTarget, IllegalStateError } from '@amazon/vinyl-util'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('PlayerRegistryImpl', () => {
    describe('addPlayer', () => {
        const loggerRef = useMockLogger()

        it('gives a warning when maxPlayersWarning has first been reached', () => {
            const vinylGlobal = new PlayerRegistryImpl(2)
            vinylGlobal.addPlayer({})
            vinylGlobal.addPlayer({})
            expect(loggerRef.value.warn).not.toHaveBeenCalled()
            vinylGlobal.addPlayer({})
            expect(loggerRef.value.warn).toHaveBeenCalledOnceWith(
                globalTarget,
                '3 Vinyl Players have been constructed without disposal. Check that player.dispose is properly being called, then increase the maxPlayersWarning option if this was intentional.'
            )
            loggerRef.value.warn.calls.reset()
            vinylGlobal.addPlayer({}) // already logged, don't log again
            expect(loggerRef.value.warn).not.toHaveBeenCalled()
        })
    })

    describe('players', () => {
        it('lists all added players', () => {
            const vinylGlobal = new PlayerRegistryImpl()
            const player1 = {}
            const player2 = {}
            vinylGlobal.addPlayer(player1)
            vinylGlobal.addPlayer(player2)
            expect(vinylGlobal.players).toEqual([player1, player2])
            const player3 = {}
            vinylGlobal.addPlayer(player3)
            expect(vinylGlobal.players).toEqual([player1, player2, player3])
            vinylGlobal.removePlayer(player2)
            expect(vinylGlobal.players).toEqual([player1, player3])
            vinylGlobal.removePlayer(player1)
            expect(vinylGlobal.players).toEqual([player3])
            vinylGlobal.removePlayer(player3)
            expect(vinylGlobal.players).toEqual([])
        })
    })

    describe('dispose', () => {
        describe('when all players have not been removed', () => {
            it('throws an illegal state error', () => {
                const vinylGlobal = new PlayerRegistryImpl()
                const player = {}
                vinylGlobal.addPlayer(player)
                expect(() => vinylGlobal.dispose()).toThrowMatching(
                    (e) => e instanceof IllegalStateError
                )
            })
        })

        describe('when all players have been removed', () => {
            it('does not throw', () => {
                const vinylGlobal = new PlayerRegistryImpl()
                const player = {}
                vinylGlobal.addPlayer(player)
                vinylGlobal.removePlayer(player)
                expect(() => vinylGlobal.dispose()).not.toThrow()
            })
        })
    })
})
