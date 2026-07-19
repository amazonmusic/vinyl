/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdControllerImpl } from '@amazon/vinyl'
import type { AdBreakInfo } from '@amazon/vinyl'

describe('AdControllerImpl', () => {
    function makeBreak(overrides: Partial<AdBreakInfo> = {}): AdBreakInfo {
        return {
            id: 'b1',
            startTime: 10,
            duration: 5,
            placement: 'midroll',
            ads: [],
            ...overrides,
        }
    }

    it('starts with no breaks and no active break', () => {
        const c = new AdControllerImpl()
        expect(c.adBreaks).toEqual([])
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreaksChange when the list changes', () => {
        const c = new AdControllerImpl()
        const events: AdBreakInfo[][] = []
        c.on('adBreaksChange', (e) => events.push([...e.current]))
        const breaks = [makeBreak()]
        c.setAdBreaks(breaks)
        expect(events.length).toBe(1)
        expect(events[0].map((b) => b.id)).toEqual(['b1'])
        expect(c.adBreaks.map((b) => b.id)).toEqual(['b1'])
    })

    it('does not re-emit when set to an equal list', () => {
        const c = new AdControllerImpl()
        let count = 0
        c.on('adBreaksChange', () => count++)
        c.setAdBreaks([makeBreak()])
        c.setAdBreaks([makeBreak()])
        expect(count).toBe(1)
    })

    it('sorts breaks by start time', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([
            makeBreak({ id: 'late', startTime: 30 }),
            makeBreak({ id: 'early', startTime: 5 }),
        ])
        expect(c.adBreaks.map((b) => b.id)).toEqual(['early', 'late'])
    })

    it('emits adBreakEnter when the playhead crosses into a break', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 5 })])
        const entered: string[] = []
        c.on('adBreakEnter', (b) => entered.push(b.id))

        c.updateTime(9)
        expect(entered).toEqual([])
        expect(c.activeAdBreak).toBeNull()

        c.updateTime(10)
        expect(entered).toEqual(['b1'])
        expect(c.activeAdBreak?.id).toBe('b1')
    })

    it('emits adBreakExit when the playhead leaves a break', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 5 })])
        const exited: string[] = []
        c.on('adBreakExit', (b) => exited.push(b.id))

        c.updateTime(12)
        expect(c.activeAdBreak?.id).toBe('b1')
        c.updateTime(15) // endTime is exclusive: 10 + 5
        expect(exited).toEqual(['b1'])
        expect(c.activeAdBreak).toBeNull()
    })

    it('does not re-emit enter while remaining inside the same break', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 10 })])
        let enters = 0
        c.on('adBreakEnter', () => enters++)
        c.updateTime(11)
        c.updateTime(12)
        c.updateTime(13)
        expect(enters).toBe(1)
    })

    it('transitions directly between adjacent breaks', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([
            makeBreak({ id: 'a', startTime: 0, duration: 10 }),
            makeBreak({ id: 'b', startTime: 10, duration: 10 }),
        ])
        const enters: string[] = []
        const exits: string[] = []
        c.on('adBreakEnter', (b) => enters.push(b.id))
        c.on('adBreakExit', (b) => exits.push(b.id))
        c.updateTime(5)
        c.updateTime(15)
        expect(enters).toEqual(['a', 'b'])
        expect(exits).toEqual(['a'])
        expect(c.activeAdBreak?.id).toBe('b')
    })

    it('treats null-duration breaks as never containing the playhead', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: null })])
        c.updateTime(10)
        c.updateTime(11)
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreakExit when the active break is removed from the list', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([makeBreak({ startTime: 10, duration: 10 })])
        c.updateTime(12)
        const exited: string[] = []
        c.on('adBreakExit', (b) => exited.push(b.id))
        c.setAdBreaks([])
        expect(exited).toEqual(['b1'])
        expect(c.activeAdBreak).toBeNull()
    })

    it('emits adBreakExit on dispose when a break is active', () => {
        const c = new AdControllerImpl()
        c.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
        c.updateTime(5)
        const exited: string[] = []
        c.on('adBreakExit', (b) => exited.push(b.id))
        c.dispose()
        expect(exited).toEqual(['b1'])
    })
})
