/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export const ErrorOrigin = {
    /**
     * The error originated from Vinyl and was reported from the uncaught exception or promise
     * rejection handlers.
     */
    UNCAUGHT: 'uncaught',

    /**
     * The error originated from Vinyl and was caught.
     */
    INTERNAL: 'internal',

    /**
     * A Vinyl interface was used incorrectly by a consumer.
     */
    API: 'api',

    /**
     * The error originated from a failed service call (500 errors).
     */
    SERVICE_EXTERNAL: 'serviceExternal',

    /**
     * The error originated from a failed service call (400 errors).
     */
    SERVICE_INTERNAL: 'serviceInternal',

    /**
     * The error originated from a problem playing provided media.
     * The reporter is from a component such as the element, source buffer, media source, etc.
     */
    MEDIA: 'media',

    /**
     * The error originated from a problem parsing input data.
     * Such as a malformed Dash or HLS manifest.
     */
    PARSING: 'parsing',

    /**
     * The error originated from an incompatibility with browser APIs,
     * such as EME.
     */
    COMPATIBILITY: 'compatibility',

    /**
     * The error originated from DRM.
     * This does not include internal or service errors, only errors from the creation of media keys or media key
     * sessions.
     */
    DRM: 'drm',
}
