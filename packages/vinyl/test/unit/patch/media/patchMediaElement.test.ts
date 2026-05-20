/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MediaElementPatchOptions, patchMediaElement } from '@amazon/vinyl'
import { MockHTMLAudioElement } from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('patchMediaElement', () => {
    const logger = useMockLogger()
    it('applies patches based on the provided flags', () => {
        const media = new MockHTMLAudioElement()
        {
            logger.value.debug.calls.reset()
            const options = {
                unreliablePlaybackEvents: true,
                preventStalls: true,
            } as const satisfies MediaElementPatchOptions
            const patchedRef = patchMediaElement(media, options)
            expect(logger.value.debug).toHaveBeenCalledTimes(
                Object.keys(options).length
            )
            patchedRef.dispose()
        }
        {
            logger.value.debug.calls.reset()
            const options = {} as const satisfies MediaElementPatchOptions
            const patchedRef = patchMediaElement(media, options)
            expect(logger.value.debug).toHaveBeenCalledTimes(0)
            patchedRef.dispose()
        }
        {
            logger.value.debug.calls.reset()
            const patchedRef = patchMediaElement(media, {})
            expect(logger.value.debug).toHaveBeenCalledTimes(0)
            patchedRef.dispose()
        }
    })
})
