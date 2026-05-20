/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isNode, persistenceRef } from '@amazon/vinyl-util'
import { MockStorage } from '@amazon/vinyl-util/browserTestUtil'

describe('persistenceRef', () => {
    beforeEach(() => {
        if (!isNode()) {
            pending('requires Node environment')
        }
    })

    describe('when localStorage is defined', () => {
        let storage: MockStorage

        beforeEach(() => {
            storage = new MockStorage()
            ;(global as any).localStorage = storage
        })

        afterEach(() => {
            delete (global as any).localStorage
        })

        it('uses localStorage', async () => {
            const persistence = persistenceRef.value
            storage.getItem.and.returnValue('expected')
            await expectAsync(persistence.get('test')).toBeResolvedTo(
                'expected'
            )
        })
    })

    describe('when localStorage is not defined', () => {
        it('uses null', async () => {
            const persistence = persistenceRef.value
            await expectAsync(persistence.get('test')).toBeResolvedTo(null)
            await expectAsync(persistence.set('test', 'value')).toBeResolved()
            await expectAsync(persistence.remove('test')).toBeResolved()
            await expectAsync(persistence.clear()).toBeResolved()
        })
    })
})
