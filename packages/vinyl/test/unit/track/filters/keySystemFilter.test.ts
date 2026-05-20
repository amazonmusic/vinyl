/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockDrmController } from '@amazon/vinyl/vinylTestUtil'
import {
    canPlayKeySystem,
    createEmptyMediaQualityMetadata,
    DrmKeySystem,
    throwKeySystemsUnsupported,
} from '@amazon/vinyl'

describe('canPlayKeySystem', () => {
    let drmController: MockDrmController

    beforeEach(() => {
        drmController = new MockDrmController()
    })

    it('returns true for unprotected content', async () => {
        const metadata = createEmptyMediaQualityMetadata()
        metadata.contentProtections = []

        expect(await canPlayKeySystem({ drmController }, metadata)).toBe(true)
        expect(drmController.isSupported).not.toHaveBeenCalled()
    })

    it('returns true when DRM controller supports the content', async () => {
        drmController.isSupported.and.returnValue(
            Promise.resolve({
                supported: true,
                persistentState: false,
            })
        )

        const metadata = createEmptyMediaQualityMetadata()
        metadata.contentProtections = [{ keySystem: DrmKeySystem.WIDEVINE }]

        expect(await canPlayKeySystem({ drmController }, metadata)).toBe(true)
        expect(drmController.isSupported).toHaveBeenCalledWith(metadata)
    })

    it('returns false when DRM controller does not support the content', async () => {
        drmController.isSupported.and.returnValue(
            Promise.resolve({
                supported: false,
                persistentState: false,
            })
        )

        const metadata = createEmptyMediaQualityMetadata()
        metadata.contentProtections = [{ keySystem: DrmKeySystem.PLAY_READY }]

        expect(await canPlayKeySystem({ drmController }, metadata)).toBe(false)
        expect(drmController.isSupported).toHaveBeenCalledWith(metadata)
    })

    it('throws correct error', () => {
        try {
            throwKeySystemsUnsupported()
            fail('Expected error to be thrown')
        } catch (error) {
            expect(error).toEqual(jasmine.any(Error))
            expect((error as Error).message).toBe('No key system supported.')
        }
    })
})
