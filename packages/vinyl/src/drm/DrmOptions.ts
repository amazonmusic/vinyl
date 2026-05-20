/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyRecord, ValueProvider } from '@amazon/vinyl-util'
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'
import type { MediaFormatMetadata } from '@/streaming/MediaQualityMetadata'
import {
    enumOf,
    func,
    isOneOf,
    number,
    object,
    type ObjectSchema,
    record,
    recordValues,
    string,
    type ValueSchema,
} from '@amazon/vinyl-validation'
import { DrmKeySystem, drmKeySystemValidator } from './DrmKeySystem'
import {
    type LicenseProvider,
    type LicenseServerOptions,
    licenseServerOptionsValidator,
} from '@/drm/licenseProvider/LicenseProvider'

/**
 * DrmRobustness is the requested security level for audio or video decryption.
 */
export enum DrmRobustness {
    SW_SECURE_CRYPTO = 'SW_SECURE_CRYPTO',
    SW_SECURE_DECODE = 'SW_SECURE_DECODE',
    HW_SECURE_CRYPTO = 'HW_SECURE_CRYPTO',
    HW_SECURE_DECODE = 'HW_SECURE_DECODE',
    HW_SECURE_ALL = 'HW_SECURE_ALL',
}

/**
 * DrmConfig configures DrmController and LicenseProvider.
 */
export interface DrmOptions {
    readonly keySystems: {
        readonly [p in DrmKeySystem]?: DrmKeySystemOptions
    } & {
        readonly [DrmKeySystem.CLEAR_KEY]?: DrmClearKeySystemOptions
    } & {
        /**
         * A wildcard to match any key system when there wasn't a match.
         */
        readonly ['*']?: DrmKeySystemOptions
    }

    /**
     *
     * If not set, the license provider from the player dependencies will
     * be used.
     */
    readonly licenseProvider?: LicenseProvider
}

/**
 * Clear key system options that extend base DRM key system options with clear
 * key mappings. Used for unencrypted content or testing scenarios where keys
 * are provided in plain text.
 */
export type DrmClearKeySystemOptions = DrmKeySystemOptions & {
    readonly keys: ReadonlyRecord<string, string>
}

export interface DrmKeySystemOptions {
    /**
     * License server configuration used to make license requests.
     */
    readonly licenseServer?: ValueProvider<LicenseServerOptions>

    /**
     * Audio-specific DRM configuration.
     */
    readonly audio?: DrmMediaKeySystemOptions

    /**
     * Video-specific DRM configuration.
     */
    readonly video?: DrmMediaKeySystemOptions

    /**
     * Key systems with a higher priority take precedence.
     * If two key systems have equal priority, the order will be as it appears
     * in DrmInfo (provided by the manifest).
     */
    readonly priority?: number

    /**
     * Transform applied to init data before session creation.
     * Always invoked for every key system. The default implementation
     * handles {@link DrmKeySystem.FAIR_PLAY_1_0} by packing the init data,
     * content ID, and server certificate into the format expected by
     * WebKit-prefixed EME. For all other key systems, returns init data
     * unchanged.
     */
    readonly initDataTransformer?: InitDataTransformer
}

/**
 * Transforms raw init data before it is passed to the CDM for session creation.
 *
 * @param initData - The raw initialization data.
 * @param initDataType - The initialization data type (e.g. 'cenc', 'skd').
 * @param drmInfo - The media format metadata for the current content.
 * @returns The transformed init data to pass to the CDM.
 */
export type InitDataTransformer = (
    initData: Uint8Array,
    initDataType: DrmInitDataType,
    drmInfo: MediaFormatMetadata
) => Uint8Array

export interface DrmMediaKeySystemOptions {
    readonly robustness?: DrmRobustness
}

export const drmRobustnessValidator: ValueSchema<DrmRobustness> =
    enumOf(DrmRobustness)

export const drmMediaKeySystemOptionsValidator: ObjectSchema<DrmMediaKeySystemOptions> =
    object({
        robustness: drmRobustnessValidator.optional(),
    })

export const drmKeySystemOptionsValidator: ObjectSchema<DrmKeySystemOptions> =
    object({
        licenseServer: func().or(licenseServerOptionsValidator).optional(),
        audio: drmMediaKeySystemOptionsValidator.optional(),
        video: drmMediaKeySystemOptionsValidator.optional(),
        priority: number().optional(),
        initDataTransformer: func().optional(),
    })

export const drmClearKeySystemOptionsValidator: ObjectSchema<DrmClearKeySystemOptions> =
    drmKeySystemOptionsValidator.extend({
        keys: recordValues(string()),
    })

export const drmOptionsValidator: ObjectSchema<DrmOptions> = object({
    keySystems: record(
        drmKeySystemValidator.or(isOneOf('*')),
        drmKeySystemOptionsValidator.optional()
    ).and(
        object<{
            readonly [DrmKeySystem.CLEAR_KEY]?: DrmClearKeySystemOptions
        }>({
            [DrmKeySystem.CLEAR_KEY]:
                drmClearKeySystemOptionsValidator.optional(),
        })
    ),

    licenseProvider: func().optional(),
})
