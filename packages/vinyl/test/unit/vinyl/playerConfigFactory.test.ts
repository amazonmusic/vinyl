/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { playerConfigFactory } from '@amazon/vinyl'
import { createDisposer, ValidationError } from '@amazon/vinyl-util'
import { object, string, number } from '@amazon/vinyl-validation'
import createSpy = jasmine.createSpy

describe('playerConfigFactory', () => {
    interface TestConfig {
        name: string
        value: number
    }

    const defaultConfig: TestConfig = {
        name: 'test',
        value: 42,
    }

    const validator = object<TestConfig>({
        name: string(),
        value: number(),
    })

    let disposer: ReturnType<typeof createDisposer>

    beforeEach(() => {
        disposer = createDisposer()
    })

    afterEach(() => {
        if (!disposer.disposed) {
            disposer.dispose()
        }
    })

    it('creates a config observable with default values', () => {
        const factory = playerConfigFactory(defaultConfig, validator)
        const config = factory({}, disposer.add)

        expect(config.value).toEqual(defaultConfig)
    })

    it('validates config data when changed', () => {
        const factory = playerConfigFactory(defaultConfig, validator)
        const config = factory({}, disposer.add)

        expect(() => {
            config.value = {
                name: 'updated',
                value: 100,
            }
        }).not.toThrow()

        expect(config.value).toEqual({
            name: 'updated',
            value: 100,
        })

        expect(() => {
            config.value = {
                name: 'updated',
                // @ts-expect-error Expected number
                value: '100',
            }
        }).toThrowError(ValidationError)
    })

    it('creates factory function that returns config observable', () => {
        const factory = playerConfigFactory(defaultConfig, validator)

        expect(typeof factory).toBe('function')

        const config = factory({}, disposer.add)
        expect(config).toBeDefined()
        expect(config.value).toEqual(defaultConfig)
    })

    it('adds validation listener to disposer', () => {
        const factory = playerConfigFactory(defaultConfig, validator)
        const addSpy = createSpy('add')

        factory({}, addSpy)

        expect(addSpy).toHaveBeenCalledTimes(1)
        expect(addSpy).toHaveBeenCalledWith(jasmine.any(Function))
    })

    it('returns same config structure for multiple calls', () => {
        const factory = playerConfigFactory(defaultConfig, validator)
        const config1 = factory({}, disposer.add)
        const config2 = factory({}, disposer.add)

        expect(config1.value).toEqual(config2.value)
        expect(config1.value).toEqual(defaultConfig)
    })
})
