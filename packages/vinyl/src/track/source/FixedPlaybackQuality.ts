/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrackEventMap } from '../Track'
import type { Unsubscribe } from '@amazon/vinyl-util'
import { EventHostImpl, type ReadonlySet } from '@amazon/vinyl-util'
import { PlaybackReadyState } from '../../playback/ReadonlyPlaybackController'
import type { PlaybackController } from '../../playback/PlaybackController'
import type { ChangeEvent } from '../../event/ChangeEvent'
import type {
    ContentType,
    MediaQualityMetadata,
} from '../../streaming/MediaQualityMetadata'

/**
 * FixedPlaybackQuality has a singular quality for selection.
 *
 * streamingQuality will always be the fixed quality.
 *
 * bufferingQuality will be the fixed quality when active, otherwise null.
 *
 * playbackQuality will be the fixed quality when active and data is buffered, otherwise null.
 */
export class FixedPlaybackQuality extends EventHostImpl<
    Pick<
        TrackEventMap,
        | 'streamingQualityChange'
        | 'bufferingQualityChange'
        | 'playbackQualityChange'
    >
> {
    private _fixedQuality!: MediaQualityMetadata
    private _contentTypes = new Set<ContentType>()

    private _isActive = false
    get active(): boolean {
        return this._isActive
    }

    constructor(
        fixedQuality: MediaQualityMetadata,
        private readonly deps: {
            readonly playbackController: PlaybackController
        }
    ) {
        super()
        this.fixedQuality = fixedQuality
    }

    get contentTypes(): ReadonlySet<ContentType> {
        return this._contentTypes
    }

    get fixedQuality(): MediaQualityMetadata {
        return this._fixedQuality
    }

    set fixedQuality(value: MediaQualityMetadata) {
        const previous = this._fixedQuality
        this._fixedQuality = value
        this._contentTypes = new Set()
        if (value.contentType) this._contentTypes.add(value.contentType)
        this.dispatch('streamingQualityChange', {
            previous,
            current: this._fixedQuality,
        })
        if (this.active) {
            this.bufferingQuality = value
            if (
                this.deps.playbackController.readyState >=
                PlaybackReadyState.HAVE_CURRENT_DATA
            ) {
                this.playbackQuality = value
            }
        }
    }

    getStreamingQuality(contentType: ContentType): MediaQualityMetadata | null {
        if (contentType !== this._fixedQuality.contentType) return null
        return this._fixedQuality
    }

    private _bufferingQuality: MediaQualityMetadata | null = null
    getBufferingQuality(contentType: ContentType): MediaQualityMetadata | null {
        if (contentType !== this._bufferingQuality?.contentType) return null
        return this._bufferingQuality
    }

    private set bufferingQuality(value: MediaQualityMetadata | null) {
        const previous = this._bufferingQuality
        if (previous === value) return
        this._bufferingQuality = value
        this.dispatch('bufferingQualityChange', {
            previous,
            current: this._bufferingQuality,
        })
    }

    private _playbackQuality: MediaQualityMetadata | null = null
    getPlaybackQuality(contentType: ContentType): MediaQualityMetadata | null {
        if (contentType !== this._playbackQuality?.contentType) return null
        return this._playbackQuality
    }

    private set playbackQuality(value: MediaQualityMetadata | null) {
        const previous = this._playbackQuality
        if (previous === value) return
        this._playbackQuality = value
        this.dispatch('playbackQualityChange', {
            previous,
            current: this._playbackQuality,
        })
    }

    private readyStateChangeSub: Unsubscribe | null = null
    activate() {
        if (this._isActive) return
        this._isActive = true
        this.bufferingQuality = this._fixedQuality
        const pC = this.deps.playbackController
        this.readyStateChangeSub = pC.on(
            'readyStateChange',
            this.onReadyStateChange
        )
        if (pC.readyState >= PlaybackReadyState.HAVE_CURRENT_DATA) {
            this.playbackQuality = this._fixedQuality
        }
    }

    deactivate() {
        if (!this._isActive) return
        this._isActive = false
        this.readyStateChangeSub!()
        this.readyStateChangeSub = null
        this.bufferingQuality = null
        this.playbackQuality = null
    }

    private onReadyStateChange = (event: ChangeEvent<PlaybackReadyState>) => {
        const hasData = event.current >= PlaybackReadyState.HAVE_CURRENT_DATA
        this.playbackQuality = hasData ? this._fixedQuality : null
    }
}
