/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type EventFakesHandle,
    implementEventFakes,
    mockEvent,
    MockMediaSource,
    MockMediaSourceGlobal,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    assertMseSupported,
    createMediaSource,
    isTypeSupported,
    nextMediaSourceEnded,
    onMediaSourceEnded,
    onMediaSourceOpen,
    supportsMse,
} from '@amazon/vinyl'
import { setUserAgent, TimeoutError } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('mediaSource', () => {
    const originalMediaSource = global.MediaSource
    const originalManagedMediaSource = global.ManagedMediaSource

    beforeEach(() => {
        global.ManagedMediaSource = undefined
        global.MediaSource = undefined!
    })

    afterEach(() => {
        global.MediaSource = originalMediaSource
        global.ManagedMediaSource = originalManagedMediaSource
        MockMediaSourceGlobal.isTypeSupported.calls.reset()
    })

    describe('supportsMse', () => {
        it('returns true if MediaSource or ManagedMediaSource is defined', () => {
            global.MediaSource = MockMediaSourceGlobal
            expect(supportsMse()).toBe(true)

            global.MediaSource = undefined!
            expect(supportsMse()).toBe(false)

            global.ManagedMediaSource = MockMediaSourceGlobal
            expect(supportsMse()).toBe(true)
        })
    })

    describe('createMediaSource', () => {
        it('creates a MediaSource from either a ManagedMediaSource or MediaSource', () => {
            global.MediaSource = MockMediaSourceGlobal
            expect(createMediaSource()).toBeInstanceOf(MockMediaSource)

            global.MediaSource = undefined!
            expect(() => createMediaSource()).toThrowError(
                'Media Source Extensions not supported'
            )

            global.ManagedMediaSource = MockMediaSourceGlobal
            expect(createMediaSource()).toBeInstanceOf(MockMediaSource)
        })
    })

    describe('assertMseSupported', () => {
        it('throws when MSE is not supported', () => {
            expect(() => assertMseSupported()).toThrowError(
                'Media Source Extensions not supported'
            )
            global.MediaSource = MockMediaSourceGlobal
            expect(() => assertMseSupported()).not.toThrow()
        })
    })

    describe('isTypeSupported', () => {
        it('Uses the static isTypeSupported from ManagedMediaSource or MediaSource', () => {
            global.ManagedMediaSource = MockMediaSourceGlobal
            MockMediaSourceGlobal.isTypeSupported.and.returnValue(true)
            expect(isTypeSupported('type1')).toBeTrue()
            expect(
                MockMediaSourceGlobal.isTypeSupported
            ).toHaveBeenCalledOnceWith('type1')
            global.ManagedMediaSource = undefined
            global.MediaSource = MockMediaSourceGlobal
            MockMediaSourceGlobal.isTypeSupported.calls.reset()
            expect(isTypeSupported('type2')).toBeTrue()
            expect(
                MockMediaSourceGlobal.isTypeSupported
            ).toHaveBeenCalledOnceWith('type2')
        })

        describe('known browser false codec reports', () => {
            beforeEach(() => {
                global.MediaSource = MockMediaSourceGlobal
                MockMediaSourceGlobal.isTypeSupported.and.returnValue(true)
            })

            afterEach(() => {
                setUserAgent('')
            })

            it('returns false for HEVC on Chromium even when the browser reports true', () => {
                setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                expect(
                    isTypeSupported(
                        'video/mp4; codecs="hvc1.2.20000000.L123.B0"'
                    )
                ).toBeFalse()
                // The browser check is short-circuited for a known false report.
                expect(
                    MockMediaSourceGlobal.isTypeSupported
                ).not.toHaveBeenCalled()
            })

            it('defers to the browser for HEVC on Safari', () => {
                setUserAgent(
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
                )
                expect(
                    isTypeSupported(
                        'video/mp4; codecs="hvc1.2.20000000.L123.B0"'
                    )
                ).toBeTrue()
                expect(MockMediaSourceGlobal.isTypeSupported).toHaveBeenCalled()
            })

            it('defers to the browser for AVC on Chromium', () => {
                setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                expect(
                    isTypeSupported('video/mp4; codecs="avc1.64001f"')
                ).toBeTrue()
                expect(MockMediaSourceGlobal.isTypeSupported).toHaveBeenCalled()
            })
        })
    })

    describe('onMediaSourceOpen', () => {
        let mediaSource: MockMediaSource
        let mediaSourceEventFakes: EventFakesHandle

        beforeEach(() => {
            mediaSource = new MockMediaSource()
            mediaSourceEventFakes = implementEventFakes(mediaSource)
        })

        describe('when already open', () => {
            beforeEach(() => {
                mediaSource.readyState = 'open'
            })

            it('invokes callback immediately', () => {
                const spy = createSpy('handler')
                onMediaSourceOpen(mediaSource, spy)
                expect(spy).toHaveBeenCalledOnceWith()
                spy.calls.reset()
                mediaSource.dispatchEvent(mockEvent('sourceopen'))
                expect(spy).toHaveBeenCalledOnceWith()
            })

            describe('when options.once is true', () => {
                it('invokes callback once', () => {
                    const spy = createSpy('handler')
                    onMediaSourceOpen(mediaSource, spy, { once: true })
                    expect(spy).toHaveBeenCalledOnceWith()
                    expect(mediaSourceEventFakes.hasAnyListeners()).toBeFalse()
                })
            })
        })

        it('invokes callback on sourceopen event', () => {
            const spy = createSpy('handler')
            onMediaSourceOpen(mediaSource, spy)
            expect(spy).not.toHaveBeenCalled()
            mediaSource.dispatchEvent(mockEvent('sourceopen'))
            expect(spy).toHaveBeenCalledOnceWith()
        })

        describe('when options.once is true', () => {
            it('invokes callback once', () => {
                const spy = createSpy('handler')
                onMediaSourceOpen(mediaSource, spy, { once: true })
                mediaSource.dispatchEvent(mockEvent('sourceopen'))
                expect(spy).toHaveBeenCalledOnceWith()
                spy.calls.reset()
                mediaSource.dispatchEvent(mockEvent('sourceopen'))
                expect(spy).not.toHaveBeenCalled()
            })
        })

        describe('when unsubscribed', () => {
            it('removes handler', () => {
                const spy = createSpy('handler')
                const unsub = onMediaSourceOpen(mediaSource, spy)
                expect(mediaSourceEventFakes.hasAnyListeners()).toBeTrue()
                unsub()
                expect(mediaSourceEventFakes.hasAnyListeners()).toBeFalse()
            })
        })
    })

    describe('onMediaSourceEnded', () => {
        let mediaSource: MockMediaSource
        let mediaSourceEventFakes: EventFakesHandle

        beforeEach(() => {
            mediaSource = new MockMediaSource()
            mediaSourceEventFakes = implementEventFakes(mediaSource)
        })

        describe('when already ended', () => {
            beforeEach(() => {
                mediaSource.readyState = 'ended'
            })

            it('invokes callback immediately', () => {
                const spy = createSpy('handler')
                onMediaSourceEnded(mediaSource, spy)
                expect(spy).toHaveBeenCalledOnceWith()
                spy.calls.reset()
                mediaSource.dispatchEvent(mockEvent('sourceended'))
                expect(spy).toHaveBeenCalledOnceWith()
            })

            describe('when options.once is true', () => {
                it('invokes callback once', () => {
                    const spy = createSpy('handler')
                    onMediaSourceEnded(mediaSource, spy, { once: true })
                    expect(spy).toHaveBeenCalledOnceWith()
                    expect(mediaSourceEventFakes.hasAnyListeners()).toBeFalse()
                })
            })
        })

        it('invokes callback on sourceended event', () => {
            const spy = createSpy('handler')
            onMediaSourceEnded(mediaSource, spy)
            expect(spy).not.toHaveBeenCalled()
            mediaSource.dispatchEvent(mockEvent('sourceended'))
            expect(spy).toHaveBeenCalledOnceWith()
        })

        describe('when options.once is true', () => {
            it('invokes callback once', () => {
                const spy = createSpy('handler')
                onMediaSourceEnded(mediaSource, spy, { once: true })
                mediaSource.dispatchEvent(mockEvent('sourceended'))
                expect(spy).toHaveBeenCalledOnceWith()
                spy.calls.reset()
                mediaSource.dispatchEvent(mockEvent('sourceended'))
                expect(spy).not.toHaveBeenCalled()
            })
        })

        describe('when unsubscribed', () => {
            it('removes handler', () => {
                const spy = createSpy('handler')
                const unsub = onMediaSourceEnded(mediaSource, spy)
                expect(mediaSourceEventFakes.hasAnyListeners()).toBeTrue()
                unsub()
                expect(mediaSourceEventFakes.hasAnyListeners()).toBeFalse()
            })
        })
    })

    describe('nextMediaSourceEnded', () => {
        let mediaSource: MockMediaSource
        const clock = useMockTime()

        beforeEach(() => {
            mediaSource = new MockMediaSource()
            implementEventFakes(mediaSource)
        })

        it('returns a promise that resolves on next media source ended state', async () => {
            const nextEnded = nextMediaSourceEnded(mediaSource)
            await expectAsync(nextEnded).toBePending()
            mediaSource.dispatchEvent(mockEvent('sourceended'))
            await expectAsync(nextEnded).toBeResolved()
        })

        it('uses the provided timeout', async () => {
            const nextEnded = nextMediaSourceEnded(mediaSource, 3, 'message')
            await clock.tick(2.9)
            await expectAsync(nextEnded).toBePending()
            await clock.tick(0.1)
            await expectAsync(nextEnded).toBeRejectedWithError(
                TimeoutError,
                'message'
            )
        })

        it('resolves immediately when media source is already ended', async () => {
            mediaSource.readyState = 'ended'
            const nextEnded = nextMediaSourceEnded(mediaSource)
            await expectAsync(nextEnded).toBeResolved()
        })
    })
})
