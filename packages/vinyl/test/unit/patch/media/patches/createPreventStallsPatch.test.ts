/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createPreventStallsPatch,
    MAX_UNCHANGED_COUNT,
    requiresPreventStallsPatch,
} from '@amazon/vinyl'
import { type PatchedRef, patchTarget, setUserAgent } from '@amazon/vinyl-util'
import {
    type EventFakesHandle,
    implementEventFakes,
    MockHTMLAudioElement,
    mockEvent,
    type MockHTMLMediaElement,
} from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('createPreventStallsPatch', () => {
    let media: MockHTMLAudioElement
    let mediaEventFakes: EventFakesHandle
    let patchedMedia: MockHTMLAudioElement
    let patchedRef: PatchedRef<MockHTMLMediaElement>
    let disposed = false
    useMockLogger()
    beforeEach(() => {
        disposed = true
        media = new MockHTMLAudioElement()
        mediaEventFakes = implementEventFakes(media)
        media.play.and.resolveTo(void 0)
        patchedRef = patchTarget<
            MockHTMLAudioElement,
            HTMLMediaElementEventMap
        >(media, createPreventStallsPatch)
        patchedMedia = patchedRef.patched
    })

    afterEach(() => {
        if (!disposed) patchedRef.dispose()
    })

    function dispatchTimeUpdates(
        count: number,
        incrementTime: boolean = false
    ) {
        for (let i = 0; i < count; i++) {
            media.dispatchEvent(mockEvent('timeupdate'))
            if (incrementTime) media.currentTime += 0.1
        }
    }

    describe('when timeupdate events repeatedly occur', () => {
        describe('and playback is paused', () => {
            it('does nothing', () => {
                media.paused = true
                dispatchTimeUpdates(MAX_UNCHANGED_COUNT)
                expect(media.pause).not.toHaveBeenCalled()
                expect(media.play).not.toHaveBeenCalled()
            })
        })

        describe('and time does not progress', () => {
            it('stops and restarts playback', () => {
                patchedMedia.currentTime = 10
                media.paused = false
                media.play.calls.reset()
                dispatchTimeUpdates(MAX_UNCHANGED_COUNT)
                expect(media.pause).not.toHaveBeenCalled()
                expect(media.play).not.toHaveBeenCalled()
                dispatchTimeUpdates(1)
                expect(media.pause).toHaveBeenCalledOnceWith()
                expect(media.play).toHaveBeenCalledOnceWith()

                media.pause.calls.reset()
                media.play.calls.reset()

                // Once stuck, do not repeatedly attempt to fix
                dispatchTimeUpdates(MAX_UNCHANGED_COUNT * 2)
                expect(media.pause).not.toHaveBeenCalled()
                expect(media.play).not.toHaveBeenCalled()

                // Unstuck
                dispatchTimeUpdates(MAX_UNCHANGED_COUNT * 2, true)
                expect(media.pause).not.toHaveBeenCalled()
                expect(media.play).not.toHaveBeenCalled()

                // Once unstuck, allow detection of stuck state again.
                dispatchTimeUpdates(MAX_UNCHANGED_COUNT + 1)
                expect(media.pause).toHaveBeenCalledOnceWith()
                expect(media.play).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('when patch is disposed', () => {
        it('removes listeners', () => {
            expect(mediaEventFakes.hasAnyListeners()).toBeTrue()
            patchedRef.dispose()
            expect(mediaEventFakes.hasAnyListeners()).toBeFalse()
            disposed = true
        })
    })
})

describe('requiresPreventStallsPatch', () => {
    function testForUa(userAgent: string, expected: boolean) {
        setUserAgent(userAgent)
        expect(requiresPreventStallsPatch())
            .withContext(`requiresPreventStallsPatch`)
            .toEqual(expected)
    }

    it('is true when browser is Edge Legacy', () => {
        testForUa('Edge/18.0.0', true)
        testForUa('Edg/108.0.0', false)
        testForUa('Chrome/120.0.0', false)
    })
})
