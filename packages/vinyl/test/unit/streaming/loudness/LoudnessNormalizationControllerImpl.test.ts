/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    LoudnessNormalizationControllerImpl,
    type LoudnessNormalizationControllerImplOptions,
    defaultLoudnessNormalizationControllerImplOptions,
} from '@amazon/vinyl'
import { data, type MutableValue } from '@amazon/vinyl-observable'

describe('LoudnessNormalizationControllerImpl', () => {
    let controller: LoudnessNormalizationControllerImpl
    let options: MutableValue<LoudnessNormalizationControllerImplOptions>

    beforeEach(() => {
        options = data<LoudnessNormalizationControllerImplOptions>(
            defaultLoudnessNormalizationControllerImplOptions
        )
        controller = new LoudnessNormalizationControllerImpl({ options })
    })

    describe('when calculating gain values', () => {
        it('gain is calculated correctly for tracks louder than target', () => {
            controller.setTrackLoudness(-9) // 5dB louder than target
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }
            const gain = controller.gain

            expect(gain).toBeCloseTo(0.316, 3) // 10^(-5/10) ≈ 0.316
        })

        it('gain is set to 1.0 when track is quieter than target', () => {
            controller.setTrackLoudness(-16) // 2dB quieter than target
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }
            const gain = controller.gain
            expect(gain).toBeCloseTo(1.0, 3)
        })

        it('gain is limited by maxGainDb setting', () => {
            controller.setTrackLoudness(-4) // 10dB louder than target
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 6, // Limit to 6dB reduction
            }
            const gain = controller.gain

            expect(gain).toBeCloseTo(0.251, 3) // 10^(-6/10) ≈ 0.251
        })

        it('gain is set to 1.0 when loudness normalization is disabled', () => {
            controller.setTrackLoudness(-9)
            options.value = {
                enabled: false,
                targetLufs: -14,
                maxGainDb: 10,
            }
            const gain = controller.gain

            expect(gain).toBe(1.0)
        })

        it('gain is set to 1.0 when track loudness is null', () => {
            controller.setTrackLoudness(null)
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }
            const gain = controller.gain

            expect(gain).toBe(1.0)
        })
    })

    describe('when handling change events', () => {
        it('change event is emitted when gain changes', () => {
            const changeListener = jasmine.createSpy('changeListener')
            controller.on('change', changeListener)
            controller.setTrackLoudness(-9)
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }

            expect(changeListener).toHaveBeenCalled()
        })

        it('change event is not emitted when gain remains the same', () => {
            controller.setTrackLoudness(-9)
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }
            const changeListener = jasmine.createSpy('changeListener')
            controller.on('change', changeListener)
            // Update config with the same values
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }

            expect(changeListener).not.toHaveBeenCalled()
        })

        it('gain is refreshed when track loudness is set', () => {
            // Set up config first
            options.value = {
                enabled: true,
                targetLufs: -14,
                maxGainDb: 10,
            }

            expect(controller.gain).toBe(1.0) // Initial gain

            // Set track loudness - should trigger gain update
            controller.setTrackLoudness(-9) // 5dB louder than target

            expect(controller.gain).toBeCloseTo(0.316, 3) // Should be updated
        })
    })
})
