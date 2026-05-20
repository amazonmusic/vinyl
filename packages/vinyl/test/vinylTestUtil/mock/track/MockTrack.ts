/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentType,
    type MediaQualityMetadata,
    type Track,
    type TrackEventMap,
} from '@amazon/vinyl'
import { RangesImpl } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<Track>()

export class MockTrack extends MockEventHost<TrackEventMap> implements Track {
    get [Symbol.toStringTag](): string {
        return `MockTrack(${this.uri})`
    }

    uri = ''
    type = ''
    active = false
    fetchedRanges = new RangesImpl()
    preload = spyFactory('preload')
    contentTypes: Set<ContentType> = new Set()
    qualities: readonly MediaQualityMetadata[] | null = null
    qualitiesUnfiltered: readonly MediaQualityMetadata[] | null = null
    getStreamingQuality = spyFactory('getStreamingQuality')
    getBufferingQuality = spyFactory('getBufferingQuality')
    getPlaybackQuality = spyFactory('getPlaybackQuality')
    extra: any = undefined
    error: Error | null = null

    activate = spyFactory('activate')
    deactivate = spyFactory('deactivate')

    clearPrefetch = spyFactory('clearPrefetch')
    reset = spyFactory('reset')
    disposed = false

    /**
     * Installs fakes for activate and deactivate to set active status.
     */
    implementActivateFakes() {
        this.activate.and.callFake(() => {
            this.active = true
        })
        this.deactivate.and.callFake(() => {
            this.active = false
        })
    }
}
