/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents all known Cache-Control directives.
 *
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
 */
export type CacheControl = {
    /**
     * The maximum amount of time (in seconds) a resource is considered fresh.
     * Example: `max-age=3600` (1 hour)
     */
    readonly maxAge?: number

    /**
     * Requires the resource to be revalidated with the origin server before serving it from the cache.
     * Example: `no-cache`
     */
    readonly noCache?: boolean

    /**
     * Prevents the resource from being cached by any mechanism.
     * Example: `no-store`
     */
    readonly noStore?: boolean

    /**
     * Ensures that stale responses cannot be used without successful revalidation with the origin server.
     * Example: `must-revalidate`
     */
    readonly mustRevalidate?: boolean

    /**
     * Indicates the resource is cacheable by both shared and private caches.
     * Example: `public`
     */
    readonly public?: boolean

    /**
     * Indicates the resource is cacheable only by the user's browser or private caches, not shared caches.
     * Example: `private`
     */
    readonly private?: boolean

    /**
     * Indicates that the resource will not change, so it does not need to be revalidated.
     * Example: `immutable`
     */
    readonly immutable?: boolean

    /**
     * Allows serving stale responses for the specified duration (in seconds) while asynchronously revalidating the
     * cache.
     * Example: `stale-while-revalidate=60`
     */
    readonly staleWhileRevalidate?: number

    /**
     * Allows serving stale responses (in seconds) if the origin server is unavailable or returns an error.
     * Example: `stale-if-error=86400` (1 day)
     */
    readonly staleIfError?: number

    /**
     * Indicates the client only wants a response from the cache and will not make a network request.
     * Example: `only-if-cached`
     */
    readonly onlyIfCached?: boolean
}

// Map for known directive names to their typed keys
const knownDirectives: Record<string, keyof CacheControl | undefined> = {
    'max-age': 'maxAge',
    'no-cache': 'noCache',
    'no-store': 'noStore',
    'must-revalidate': 'mustRevalidate',
    public: 'public',
    private: 'private',
    immutable: 'immutable',
    'stale-while-revalidate': 'staleWhileRevalidate',
    'stale-if-error': 'staleIfError',
    'only-if-cached': 'onlyIfCached',
} as const

/**
 * Parses a Cache-Control header string into a structured object.
 * Handles known directives with optional numeric values.
 *
 * @param str - The Cache-Control header string to parse.
 * @returns A CacheControl object representing the parsed directives.
 */
export function parseCacheControl(
    str: string | null | undefined
): CacheControl {
    if (!str) return {}
    const directives: any = {}
    str.split(',').forEach((part) => {
        const [key, value] = part.trim().split('=') as [string, string?]
        const directiveKey = key.trim().toLowerCase() // Ensure case-insensitivity

        const typedKey = knownDirectives[directiveKey]
        if (typedKey) {
            // Parse the value or set to true for boolean directives
            if (value === undefined) {
                directives[typedKey] = true
            } else {
                const numericValue = parseInt(value, 10)
                directives[typedKey] = isNaN(numericValue)
                    ? value
                    : numericValue
            }
        }
    })
    return directives
}
