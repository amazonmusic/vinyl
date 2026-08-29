/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockCapabilities } from '@amazon/vinyl/vinylTestUtil'
import {
    canPlayMimeType,
    createEmptyMediaQualityMetadata,
    throwMimeTypesUnsupported,
} from '@amazon/vinyl'

describe('canPlayMimeType', () => {
    let capabilities: MockCapabilities

    beforeEach(() => {
        capabilities = new MockCapabilities()
    })

    it('returns false for unsupported mime types', () => {
        capabilities.canPlayTypeMse.and.returnValue(false)
        const metadata = createEmptyMediaQualityMetadata()
        metadata.mimeType = 'audio/mp4; codecs="flac"'

        expect(canPlayMimeType({ capabilities }, metadata)).toBe(false)
    })

    it('returns true for supported mime types', () => {
        capabilities.canPlayTypeMse.and.returnValue(true)
        const metadata = createEmptyMediaQualityMetadata()
        metadata.mimeType = 'audio/mp4; codecs="opus"'

        expect(canPlayMimeType({ capabilities }, metadata)).toBe(true)
        expect(capabilities.canPlayTypeMse).toHaveBeenCalledWith(
            'audio/mp4; codecs="opus"'
        )
    })

    it('returns false for WebM containers even when the browser reports support', () => {
        capabilities.canPlayTypeMse.and.returnValue(true)
        const metadata = createEmptyMediaQualityMetadata()
        metadata.mimeType = 'video/webm; codecs="vp9"'

        expect(canPlayMimeType({ capabilities }, metadata)).toBe(false)
        // Rejected on container alone; the browser check is never consulted.
        expect(capabilities.canPlayTypeMse).not.toHaveBeenCalled()
    })

    it('returns false for Matroska containers', () => {
        capabilities.canPlayTypeMse.and.returnValue(true)
        const metadata = createEmptyMediaQualityMetadata()
        metadata.mimeType = 'audio/x-matroska; codecs="opus"'

        expect(canPlayMimeType({ capabilities }, metadata)).toBe(false)
    })

    it('returns false for null mime type', () => {
        capabilities.canPlayTypeMse.and.returnValue(true)
        const metadata = createEmptyMediaQualityMetadata()
        metadata.mimeType = null

        expect(canPlayMimeType({ capabilities }, metadata)).toBe(false)
        expect(capabilities.canPlayTypeMse).not.toHaveBeenCalled()
    })

    it('throws correct error', () => {
        try {
            throwMimeTypesUnsupported()
            fail('Expected error to be thrown')
        } catch (error) {
            expect(error).toEqual(jasmine.any(Error))
            expect((error as Error).message).toBe(
                'No resource type supported (container/codec).'
            )
        }
    })
})
