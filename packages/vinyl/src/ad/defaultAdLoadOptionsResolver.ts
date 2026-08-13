/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdInfo } from './AdBreakInfo'
import { createTrackLoadOptionsFromUrl } from '../track/inferLoadOptionsFromUri'
import type { VinylTrackLoadOptions } from '../track/createVinylTrackFactories'
import { ErrorOrigin, ReportableError } from '@amazon/vinyl-util'

export async function defaultAdLoadOptionsResolver(
    adInfo: AdInfo
): Promise<VinylTrackLoadOptions> {
    if (!adInfo.uri)
        throw new UnresolvableAdError('Ad with no URI cannot be played')
    const loadOptions = await createTrackLoadOptionsFromUrl(adInfo.uri)
    if (!loadOptions)
        throw new UnresolvableAdError(
            `could not infer ad track type from uri ${adInfo.uri}`
        )
    return loadOptions
}

/**
 * An error indicating that a method was called with illegal arguments.
 */
export class UnresolvableAdError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'UnresolvableAdError'
    }

    constructor(message: string) {
        super(message, ErrorOrigin.MEDIA)
        Object.setPrototypeOf(this, UnresolvableAdError.prototype)
    }
}
