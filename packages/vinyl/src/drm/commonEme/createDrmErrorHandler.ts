/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmError } from '@/drm/error/DrmError'
import { ErrorLevel, ErrorOrigin, toJson } from '@amazon/vinyl-util'

export function createDrmErrorHandler(
    level: ErrorLevel = ErrorLevel.FATAL
): (error: Error) => never {
    return (error) => {
        throw new DrmError(
            error.message,
            { error: toJson(error) },
            ErrorOrigin.DRM,
            level
        )
    }
}
