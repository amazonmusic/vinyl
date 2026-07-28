/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackSource } from '../../playback/PlaybackSource'
import type { Track, TrackTypeId, TrackUri } from '../Track'
import { type TrackBaseDeps } from '../TrackBase'
import {
    type TrackFactory,
    type TrackLoadOptions,
    trackLoadOptionsValidator,
} from '../TrackFactory'
import { ErrorOrigin, type Maybe } from '@amazon/vinyl-util'
import { func, isOneOf, type ObjectSchema } from '@amazon/vinyl-validation'
import {
    SourceTrackBase,
    type SourceTrackBaseOptions,
    sourceTrackBaseOptionsValidator,
} from './SourceTrackBase'

/**
 * Dependencies for a SourceObjectTrack.
 */
export interface SourceObjectTrackDeps extends TrackBaseDeps {
    readonly playbackSource: PlaybackSource
}

export interface SourceObjectTrackLoadOptions extends TrackLoadOptions {
    readonly type: 'srcObject'

    /**
     * A function to produce a MediaStream, or Promise<MediaStream>.
     */
    readonly srcObjectProvider: (
        uri: TrackUri
    ) => Promise<MediaStream> | MediaStream

    /**
     * Configuration options for the SourceObjectTrack.
     * Will be provided on preload and activate.
     */
    readonly config?: Maybe<SourceTrackBaseOptions>
}

const loadOptionsValidator: ObjectSchema<SourceObjectTrackLoadOptions> =
    trackLoadOptionsValidator.extend({
        srcObjectProvider: func(),
        type: isOneOf('srcObject'),
        config: sourceTrackBaseOptionsValidator.maybe().optional(),
    })

export function createSourceObjectTrackFactory(
    deps: SourceObjectTrackDeps
): TrackFactory<SourceObjectTrackLoadOptions> {
    return {
        validate(options: SourceObjectTrackLoadOptions): void {
            loadOptionsValidator.assert(options, ErrorOrigin.API)
        },

        createTrack(options: SourceObjectTrackLoadOptions): Track {
            return new SourceObjectTrack(
                options.uri,
                options.type,
                Promise.resolve(options.srcObjectProvider(options.uri)),
                deps
            )
        },
    }
}

// TODO: Accept a provider function instead of a Promise for srcObject to support reset.
export class SourceObjectTrack extends SourceTrackBase<MediaStream> {
    get [Symbol.toStringTag](): string {
        return 'SourceObjectTrack'
    }

    constructor(
        uri: TrackUri,
        type: TrackTypeId,
        srcObject: Promise<MediaStream>,
        protected readonly deps: SourceObjectTrackDeps
    ) {
        super(uri, type, srcObject, deps)
    }

    protected setSrc(src: MediaStream) {
        this.deps.playbackSource.srcObject = src
    }

    protected clearSrc(): void {
        this.deps.playbackSource.srcObject = null
        this.deps.playbackSource.load()
    }
}
