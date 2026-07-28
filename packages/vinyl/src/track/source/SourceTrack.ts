/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Track, TrackTypeId, TrackUri } from '../Track'
import { type TrackBaseDeps } from '../TrackBase'
import {
    type TrackFactory,
    type TrackLoadOptions,
    trackLoadOptionsValidator,
} from '../TrackFactory'
import { ErrorOrigin, type Maybe } from '@amazon/vinyl-util'
import {
    func,
    isOneOf,
    type ObjectSchema,
    string,
} from '@amazon/vinyl-validation'
import {
    SourceTrackBase,
    type SourceTrackBaseOptions,
    sourceTrackBaseOptionsValidator,
} from './SourceTrackBase'
import type { PlaybackSource } from '../../playback/PlaybackSource'

/**
 * Dependencies for a SourceTrack.
 */
export interface SourceTrackDeps extends TrackBaseDeps {
    readonly playbackSource: PlaybackSource
}

export interface SourceTrackLoadOptions extends TrackLoadOptions {
    readonly type: 'src'

    /**
     * If set, will be called to provide the track src.
     * Otherwise, the uri will be used.
     */
    readonly srcProvider?: Maybe<(uri: TrackUri) => Promise<string> | string>

    /**
     * Configuration options for the SourceTrack.
     * Will be provided on preload and activate.
     */
    readonly config?: Maybe<SourceTrackBaseOptions>
}

const loadOptionsValidator: ObjectSchema<SourceTrackLoadOptions> =
    trackLoadOptionsValidator.extend({
        config: sourceTrackBaseOptionsValidator.maybe().optional(),
        srcProvider: func().maybe().optional(),
        type: isOneOf('src'),
        uri: string().notEmpty(),
    })

export function createSourceTrackFactory(
    deps: SourceTrackDeps
): TrackFactory<SourceTrackLoadOptions> {
    return {
        validate(options: SourceTrackLoadOptions) {
            loadOptionsValidator.assert(options, ErrorOrigin.API)
        },

        createTrack(options: SourceTrackLoadOptions): Track {
            return new SourceTrack(
                options.uri,
                options.type,
                options.srcProvider
                    ? Promise.resolve(options.srcProvider(options.uri))
                    : Promise.resolve(options.uri),
                deps
            )
        },
    }
}

// TODO: Accept a provider function instead of a Promise for src to support reset.
export class SourceTrack extends SourceTrackBase<string> {
    get [Symbol.toStringTag](): string {
        return 'SourceTrack'
    }

    constructor(
        uri: TrackUri,
        type: TrackTypeId,
        src: Promise<string>,
        protected readonly deps: SourceTrackDeps
    ) {
        super(uri, type, src, deps)
    }

    protected setSrc(src: string) {
        this.deps.playbackSource.src = src
    }

    protected clearSrc() {
        this.deps.playbackSource.src = null
        this.deps.playbackSource.load()
    }
}
