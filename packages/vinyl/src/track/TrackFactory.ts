/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRecord, Maybe, ReadonlyRecord } from '@amazon/vinyl-util'
import { ErrorOrigin, ownKeys } from '@amazon/vinyl-util'
import type { ObjectSchema } from '@amazon/vinyl-validation'
import {
    isOneOf,
    object,
    string,
    type ValueSchema,
} from '@amazon/vinyl-validation'

import type { Track, TrackTypeId, TrackUri } from '@/track/Track'

export interface TrackLoadOptions {
    /**
     * The track type, used to map to a track factory.
     */
    readonly type: TrackTypeId

    /**
     * The track identifier.
     */
    readonly uri: TrackUri

    /**
     * The track configuration.
     */
    readonly config?: Maybe<AnyRecord>
}

export const trackLoadOptionsValidator: ObjectSchema<TrackLoadOptions> = object(
    {
        type: string(),
        uri: string().notEmpty(),
        config: object({}).maybe().optional(),
    }
)

/**
 * Produces a new Track for the given configuration options.
 */
export interface TrackFactory<TrackLoadOptionsType extends TrackLoadOptions> {
    /**
     * Throws a validation error if the track options are invalid.
     */
    validate(options: TrackLoadOptionsType): void

    /**
     * Constructs a new track from the provided load options.
     */
    createTrack(options: TrackLoadOptionsType): Track
}

export type InferLoadOptionsFromFactory<T extends TrackFactory<any>> =
    T extends TrackFactory<infer LoadOptions> ? LoadOptions : never

export type CombinedTrackFactoryOptions<
    T extends ReadonlyRecord<TrackTypeId, TrackFactory<TrackLoadOptions>>,
> = InferLoadOptionsFromFactory<T[keyof T]>

export type TrackFactoryRecord = ReadonlyRecord<
    TrackTypeId,
    TrackFactory<TrackLoadOptions>
>

/**
 * Validates that the keys of the track factory record match the track type
 * for the track factory.
 */
export type ValidTrackFactoryRecord<T extends TrackFactoryRecord> = {
    readonly [K in keyof T]: K extends InferLoadOptionsFromFactory<T[K]>['type']
        ? T[K]
        : never
}

/**
 * Given a map of TrackTypeId => TrackFactory, returns a track factory
 * that supports any of the provided track types.
 * The factory will be mapped by the track load options `type` property.
 *
 * @param factories
 */
export function createTrackFactory<T extends TrackFactoryRecord>(
    factories: ValidTrackFactoryRecord<T>
): TrackFactory<CombinedTrackFactoryOptions<T>> {
    // Validates that the track type attempting to be created exists in the factory map.
    const typeValidator: ValueSchema<keyof T> = isOneOf(...ownKeys(factories))
    return {
        validate(options): void {
            typeValidator.assert(options.type, ErrorOrigin.API)
            factories[options.type].validate(options)
        },

        createTrack(options): Track {
            return factories[options.type].createTrack(options)
        },
    }
}
