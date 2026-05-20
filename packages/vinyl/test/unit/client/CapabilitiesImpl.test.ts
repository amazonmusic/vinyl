/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    audioContextRef,
    CanPlayTypeResult,
    CapabilitiesImpl,
    DrmKeySystem,
    supportsMse,
} from '@amazon/vinyl'
import {
    MockAudioContext,
    MockHTMLAudioElement,
    type MockHTMLMediaElement,
    MockMediaSourceGlobal,
} from '@amazon/vinyl-util/browserTestUtil'
import { MockDrmController } from '@amazon/vinyl/vinylTestUtil'

import { overrideGlobalInit } from '@amazon/vinyl-util/testUtil'

describe('CapabilitiesImpl', () => {
    let media: MockHTMLMediaElement
    let capabilities: CapabilitiesImpl
    let drmController: MockDrmController

    beforeEach(() => {
        media = new MockHTMLAudioElement()
        drmController = new MockDrmController()
        capabilities = new CapabilitiesImpl({ media, drmController })
    })

    describe('mse', () => {
        it('returns supportsMse', () => {
            expect(capabilities.mse).toBe(supportsMse())
        })
    })

    describe('eme', () => {
        it('returns drmController.isEmeSupported', () => {
            drmController.isEmeSupported.and.returnValue(true)
            expect(capabilities.eme).toBeTrue()
            drmController.isEmeSupported.and.returnValue(false)
            expect(capabilities.eme).toBeFalse()
        })
    })

    describe('dash', () => {
        it(`returns truthy result from canPlayType 'application/dash+xml'`, () => {
            media.canPlayType.and.callFake((type: any) => {
                if (type === 'application/dash+xml') return 'probably'
                else return ''
            })
            expect(capabilities.dash).toBe(true)
            media.canPlayType.and.returnValue('')
            expect(capabilities.dash).toBe(false)
        })
    })

    describe('hls', () => {
        it(`returns truthy result from canPlayType 'application/vnd.apple.mpegurl'`, () => {
            media.canPlayType.and.callFake((type: any) => {
                if (type === 'application/vnd.apple.mpegurl') return 'maybe'
                else return ''
            })
            expect(capabilities.hls).toBe(true)
            media.canPlayType.and.returnValue('')
            expect(capabilities.hls).toBe(false)
        })
    })

    describe('sampleRate', () => {
        describe('when audio context is supported', () => {
            const mockAudioContextRef = overrideGlobalInit(
                audioContextRef,
                () => new MockAudioContext()
            )

            it('resolves to the sampleRate reported by the audio context singleton', () => {
                const mockAudioContext = mockAudioContextRef.value
                mockAudioContext.sampleRate = 44100
                expect(capabilities.sampleRate).toBe(44100)
                mockAudioContext.sampleRate = 48000
                expect(capabilities.sampleRate).toBe(48000)
            })
        })

        describe('when audio context is not supported', () => {
            overrideGlobalInit(audioContextRef, () => null)

            it('resolves to null', () => {
                expect(capabilities.sampleRate).toBe(null)
            })
        })
    })

    describe('canPlayType', () => {
        it('returns empty string if HTMLMediaElement.canPlayType is not defined ', () => {
            media.canPlayType = undefined!
            expect(capabilities.canPlayType('flac')).toBe(CanPlayTypeResult.NO)
        })

        describe('when media returns empty string', () => {
            it('returns CanPlayTypeResult.NO', () => {
                media.canPlayType.and.returnValue('')
                expect(capabilities.canPlayType('flac')).toBe(
                    CanPlayTypeResult.NO
                )
            })
        })

        describe(`when media returns 'probably'`, () => {
            it('returns CanPlayTypeResult.PROBABLY', () => {
                media.canPlayType.and.returnValue('probably')
                expect(capabilities.canPlayType('')).toBe(
                    CanPlayTypeResult.PROBABLY
                )
            })
        })

        describe(`when media returns 'maybe'`, () => {
            it('returns CanPlayTypeResult.MAYBE', () => {
                media.canPlayType.and.returnValue('maybe')
                expect(capabilities.canPlayType('')).toBe(
                    CanPlayTypeResult.MAYBE
                )
            })
        })
    })

    describe('canPlayTypeMse', () => {
        const originalMediaSource = global.MediaSource
        const originalManagedMediaSource = global.ManagedMediaSource

        beforeEach(() => {
            global.MediaSource = MockMediaSourceGlobal
            global.ManagedMediaSource = undefined
        })

        afterEach(() => {
            global.MediaSource = originalMediaSource
            global.ManagedMediaSource = originalManagedMediaSource
            MockMediaSourceGlobal.isTypeSupported.calls.reset()
        })

        it('delegates to isTypeSupported', () => {
            MockMediaSourceGlobal.isTypeSupported.and.returnValues(true, false)
            expect(capabilities.canPlayTypeMse('flac')).toBeTrue()
            expect(capabilities.canPlayTypeMse('opus')).toBeFalse()
        })
    })

    describe('supportsKeySystem', () => {
        it('returns drmController.isSupported with common format and given key system', async () => {
            drmController.isSupported.and.resolveTo({
                supported: true,
                persistentState: false,
            })
            await expectAsync(
                capabilities.supportsKeySystem(DrmKeySystem.CLEAR_KEY)
            ).toBeResolvedTo({
                supported: true,
                persistentState: false,
            })
            drmController.isSupported.and.resolveTo({
                supported: false,
                persistentState: false,
            })
            await expectAsync(
                capabilities.supportsKeySystem(DrmKeySystem.CLEAR_KEY)
            ).toBeResolvedTo({
                supported: false,
                persistentState: false,
            })
        })
    })
})
