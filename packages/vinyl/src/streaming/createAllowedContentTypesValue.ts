/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    ContentType,
    RestrictableContentType,
} from './MediaQualityMetadata'
import type { ContentTypesValue } from './ContentTypesValue'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { combineData } from '@amazon/vinyl-observable'
import type { ReadonlySet } from '@amazon/vinyl-util'

export interface AllowedContentTypesValueDeps {
    /**
     * The unfiltered content types present in the manifest.
     */
    readonly baseContentTypesValue: ContentTypesValue

    /**
     * The player options. The `allowedContentTypes` allow list restricts which
     * media content types are streamed; `null` means no restriction.
     */
    readonly options: ObservableValue<{
        readonly allowedContentTypes: readonly RestrictableContentType[] | null
    }>
}

/**
 * Wraps a {@link ContentTypesValue} with the `allowedContentTypes` allow list
 * from the player options. When the allow list is set, only media content
 * types (`'audio'`, `'video'`) in the list are emitted; other media streams
 * are ignored. When it is `null`, the underlying content types pass through
 * unchanged. Text is never restricted by the allow list and always passes
 * through (captions are governed by caption selection).
 *
 * Because the result is derived from the `allowedContentTypes` option via
 * {@link combineData}, changing the option re-emits a newly filtered set, which
 * reloads the track using only the allowed content types.
 */
export function createAllowedContentTypesValue(
    deps: AllowedContentTypesValueDeps
): ContentTypesValue {
    return combineData({
        contentTypes: deps.baseContentTypesValue,
        allowedContentTypes: deps.options.pick('allowedContentTypes'),
    }).map(async ({ contentTypes, allowedContentTypes }) => {
        return filterContentTypes(await contentTypes, allowedContentTypes)
    })
}

/**
 * Returns the subset of `contentTypes` permitted by the `allowedContentTypes`
 * allow list. A `null` allow list permits everything. Text always passes
 * through regardless of the allow list.
 */
function filterContentTypes(
    contentTypes: ReadonlySet<ContentType>,
    allowedContentTypes: readonly RestrictableContentType[] | null
): ReadonlySet<ContentType> {
    if (allowedContentTypes == null) return contentTypes
    const allowed = new Set<ContentType>(allowedContentTypes)
    const filtered = new Set<ContentType>()
    for (const contentType of contentTypes) {
        // Text is not subject to the allow list; keep it regardless.
        if (contentType === 'text' || allowed.has(contentType)) {
            filtered.add(contentType)
        }
    }
    return filtered
}
