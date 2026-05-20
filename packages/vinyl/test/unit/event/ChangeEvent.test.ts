/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import createSpy = jasmine.createSpy
import { type ChangeEvent, createChangeEventTrigger } from '@amazon/vinyl'

describe('createChangeEventTr' + 'igger', () => {
    it('returns a function that calls an inner function with a change event', () => {
        const o = { value: 1 }
        const spy = createSpy<(e: ChangeEvent<number>) => void>('valueChanged')
        const trigger = createChangeEventTrigger(() => o.value, spy)
        expect(spy).not.toHaveBeenCalled()
        o.value = 2
        trigger()
        expect(spy).toHaveBeenCalledOnceWith({ previous: 1, current: 2 })

        spy.calls.reset()
        o.value = 3
        trigger()
        expect(spy).toHaveBeenCalledOnceWith({ previous: 2, current: 3 })
    })
})
