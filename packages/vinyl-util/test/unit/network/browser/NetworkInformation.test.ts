/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getNetworkInformation, isNode } from '@amazon/vinyl-util'
import { MockNetworkInformation } from '@amazon/vinyl-util/testUtil'

describe('getNetworkInformation', () => {
    describe('when window.navigator.connection is defined', () => {
        beforeEach(() => {
            if (!isNode()) {
                pending('requires node environment to test')
                return
            }
            ;(global as any).window = {
                navigator: {
                    connection: new MockNetworkInformation(),
                },
            }
        })

        afterEach(() => {
            if (isNode()) delete (global as any).window
        })

        it('returns NetworkInformation', () => {
            expect(getNetworkInformation()).toBeDefined()
        })
    })

    describe('when window.navigator.connection is not defined', () => {
        beforeEach(() => {
            if (!isNode()) pending('requires node environment to test')
        })

        afterEach(() => {
            if (isNode()) delete (global as any).window
        })

        it('returns undefined', () => {
            expect(getNetworkInformation()).not.toBeDefined()
            ;(global as any).window = {
                navigator: {},
            }
            expect(getNetworkInformation()).not.toBeDefined()
            delete (global as any).window
        })
    })
})
