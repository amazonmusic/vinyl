/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlaybackSourceImpl } from '@amazon/vinyl'
import {
    MockHTMLAudioElement,
    MockMediaStream,
} from '@amazon/vinyl-util/browserTestUtil'

describe('PlaybackSource', () => {
    it(`directly relies on the media element's functionality`, () => {
        const media = new MockHTMLAudioElement()
        const p = new PlaybackSourceImpl({ media })
        p.crossOrigin = 'use-credentials'
        expect(media.crossOrigin).toBe('use-credentials')
        expect(p.crossOrigin).toBe('use-credentials')
        p.load()
        expect(media.load).toHaveBeenCalledOnceWith()
        p.src = 'https://example.com/'
        expect(media.src).toBe('https://example.com/')
        expect(p.src).toBe(media.src)
        expect(p.currentSrc).toBe(media.currentSrc)
        expect(p.srcObject).toBe(media.srcObject as MediaStream | null)
        const src = new MockMediaStream()
        p.srcObject = src
        expect(media.srcObject).toBe(src)
    })

    it('deletes src attribute on the element when assigned null', () => {
        const media = new MockHTMLAudioElement()
        const p = new PlaybackSourceImpl({ media })
        p.src = 'https://example.com/test.mp3'
        expect(media.src).toBe('https://example.com/test.mp3')
        p.src = null
        expect(media.removeAttribute).toHaveBeenCalledOnceWith('src')
    })

    describe('disableRemotePlayback', () => {
        it('delegates to the media element', () => {
            const media = new MockHTMLAudioElement()
            const p = new PlaybackSourceImpl({ media })
            media.disableRemotePlayback = true
            expect(p.disableRemotePlayback).toBeTrue()
            p.disableRemotePlayback = false
            expect(p.disableRemotePlayback).toBeFalse()
        })
    })
})
