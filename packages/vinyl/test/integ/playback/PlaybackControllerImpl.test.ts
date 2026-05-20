/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { nextHasMetadata, PlaybackControllerImpl } from '@amazon/vinyl'
import { setTestTimeout } from '@amazon/vinyl-util/browserTestUtil'
import {
    mediaRef,
    MockLoudnessNormalizationController,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'

import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('PlaybackControllerImpl integ', () => {
    let media: HTMLMediaElement
    let controller: PlaybackControllerImpl
    let originalMuted: boolean
    setTestTimeout(25)

    beforeEach(() => {
        media = mediaRef.value
        originalMuted = media.muted
        if (!media.muted) {
            // Original muted state depends on the checkAudio query flag, set it.
            media.muted = true
        }
        controller = new PlaybackControllerImpl({
            media,
            loudnessNormalizationController:
                new MockLoudnessNormalizationController(),
        })
    })

    afterEach(() => {
        media.muted = originalMuted
        controller.dispose()
    })

    describe('mutedChange', () => {
        it('emits when muted value has changed', async () => {
            const mutedChangeSpy = createEventSpy(controller, 'mutedChange')
            media.src =
                vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps
            await nextHasMetadata(controller)

            let next = mutedChangeSpy.next()
            media.muted = false
            await expectAsync(next).toBeResolvedTo({
                previous: true,
                current: false,
            })
            next = mutedChangeSpy.next()
            media.muted = true
            await expectAsync(next).toBeResolvedTo({
                previous: false,
                current: true,
            })
        })
    })
})
