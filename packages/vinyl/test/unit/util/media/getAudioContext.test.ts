/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createAudioContext, getAudioContext } from '@amazon/vinyl'
import { isNode } from '@amazon/vinyl-util'
import { MockAudioContext } from '@amazon/vinyl-util/browserTestUtil'

describe('audioContext', () => {
    describe('createAudioContext', () => {
        beforeEach(() => {
            if (!isNode()) pending('requires node environment to test')
        })

        describe('when AudioContext is not supported', () => {
            it('returns null', () => {
                expect(createAudioContext()).toBeNull()
            })
        })

        describe('when AudioContext is supported', () => {
            beforeEach(() => {
                global.AudioContext = MockAudioContext
            })

            afterEach(() => {
                delete (global as any).AudioContext
            })

            it('creates a new AudioContext instance if it does not exist', () => {
                expect(createAudioContext()).toBeInstanceOf(MockAudioContext)
            })
        })

        describe('when webkitAudioContext is supported', () => {
            beforeEach(() => {
                global.webkitAudioContext = MockAudioContext
            })

            afterEach(() => {
                delete (global as any).webkitAudioContext
            })

            it('creates a new AudioContext instance if it does not exist', () => {
                expect(createAudioContext()).toBeInstanceOf(MockAudioContext)
            })
        })
    })

    describe('getAudioContext', () => {
        it('returns the audio context singleton', () => {
            const audioContext = getAudioContext()
            expect(getAudioContext()).toBe(audioContext)
        })
    })
})
