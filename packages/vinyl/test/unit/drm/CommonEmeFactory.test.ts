/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    MockMSMediaKeys,
    useWebKitMediaKeys,
} from '@amazon/vinyl/vinylTestUtil'
import {
    commonEmeFactory,
    MsCommonEme,
    StandardCommonEme,
    WebKitCommonEme,
} from '@amazon/vinyl'
import { isNode } from '@amazon/vinyl-util'

function useStandardMediaKeys() {
    const originalMediaKeys = global.MediaKeys
    beforeEach(() => {
        global.MediaKeys = {} as any
    })
    afterEach(() => {
        global.MediaKeys = originalMediaKeys
    })
}

function useMsMediaKeys() {
    const originalMSMediaKeys = (global as any).MSMediaKeys
    beforeEach(() => {
        ;(global as any).MSMediaKeys = MockMSMediaKeys
    })

    afterEach(() => {
        ;(global as any).MSMediaKeys = originalMSMediaKeys
    })
}

describe('CommonEmeFactory', () => {
    beforeEach(() => {
        if (!isNode()) pending('Cannot mock EME API outside Node')
    })

    describe('when WebKit EME is supported', () => {
        useWebKitMediaKeys(true)

        it('returns WebKitCommonEme instance', () => {
            expect(commonEmeFactory()).toBeInstanceOf(WebKitCommonEme)
        })

        describe('and standard EME is supported', () => {
            useStandardMediaKeys()

            // WebKit prefix currently takes priority, needs testing if necessary.
            it('returns WebKitCommonEme instance', () => {
                expect(commonEmeFactory()).toBeInstanceOf(WebKitCommonEme)
            })
        })
    })

    describe('when standard EME is supported', () => {
        useStandardMediaKeys()

        it('returns StandardMediaKeys', () => {
            expect(commonEmeFactory()).toBeInstanceOf(StandardCommonEme)
        })
    })

    describe('when MS EME is supported', () => {
        useMsMediaKeys()

        it('returns MSCommonEme', () => {
            expect(commonEmeFactory()).toBeInstanceOf(MsCommonEme)
        })

        describe('and standard EME is supported', () => {
            useStandardMediaKeys()

            // standard takes priority
            it('returns StandardCommonEme', () => {
                expect(commonEmeFactory()).toBeInstanceOf(StandardCommonEme)
            })
        })
    })
})
