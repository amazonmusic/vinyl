/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyVttCueStyle, isVttCue, type VttCueStyle } from '@amazon/vinyl'

describe('VttCueStyle', () => {
    describe('isVttCue', () => {
        let original: unknown
        beforeEach(() => {
            original = (globalThis as any).VTTCue
        })
        afterEach(() => {
            ;(globalThis as any).VTTCue = original
        })

        it('is true for a VTTCue instance', () => {
            class FakeVttCue {}
            ;(globalThis as any).VTTCue = FakeVttCue
            expect(isVttCue(new FakeVttCue() as unknown as TextTrackCue)).toBe(
                true
            )
        })

        it('is false for a non-VTTCue cue', () => {
            class FakeVttCue {}
            ;(globalThis as any).VTTCue = FakeVttCue
            expect(isVttCue({} as unknown as TextTrackCue)).toBe(false)
        })

        it('is false when VTTCue is unavailable', () => {
            ;(globalThis as any).VTTCue = undefined
            expect(isVttCue({} as unknown as TextTrackCue)).toBe(false)
        })
    })

    describe('applyVttCueStyle', () => {
        it('applies every provided property', () => {
            const cue = {} as Record<string, unknown>
            const style: VttCueStyle = {
                align: 'start',
                line: 5,
                lineAlign: 'center',
                position: 10,
                positionAlign: 'center',
                size: 90,
                snapToLines: false,
                vertical: 'rl',
            }
            applyVttCueStyle(cue as unknown as VTTCue, style)
            expect(cue).toEqual({
                align: 'start',
                line: 5,
                lineAlign: 'center',
                position: 10,
                positionAlign: 'center',
                size: 90,
                snapToLines: false,
                vertical: 'rl',
            })
        })

        it('accepts the `auto` keyword for line and position', () => {
            const cue = {} as Record<string, unknown>
            applyVttCueStyle(cue as unknown as VTTCue, {
                line: 'auto',
                position: 'auto',
            })
            expect(cue.line).toBe('auto')
            expect(cue.position).toBe('auto')
        })

        it('leaves unset properties untouched', () => {
            const cue = { size: 100 } as Record<string, unknown>
            applyVttCueStyle(cue as unknown as VTTCue, {})
            expect(cue).toEqual({ size: 100 })
        })
    })
})
