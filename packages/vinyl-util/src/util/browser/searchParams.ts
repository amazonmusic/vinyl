/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { memoize } from '../fun/memoize'
import { getLocation } from '../../global/environment'

/**
 * Returns a `URLSearchParams` object for the given search substring. This is memoized for the
 * last search provided.
 * @param search (Optional) The window's search substring. Defaults to `location.search`, overridden
 * only for unit tests.
 */
export const getSearchParams = memoize(
    (search: string = getLocationSearch()): URLSearchParams => {
        const url = new URL('about:blank')
        url.search = search
        // Uses `URL.searchParams` over `new URLSearchParams`; URLSearchParams constructor is not
        // as widely supported.
        return url.searchParams
    },
    (search: string = getLocationSearch()) => search,
    1
)

/**
 * If the environment has a `location` object, returns the location's search. Otherwise,
 * an empty string.
 */
export function getLocationSearch(): string {
    return getLocation().search
}
