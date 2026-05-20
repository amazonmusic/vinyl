/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Offline utility that can be shared between the service worker and application.
 * Note - this should not use any dependencies; the bundled service worker must
 * be lightweight.
 */

import { type CacheControl, parseCacheControl } from './CacheControl'

export const DEFAULT_CACHE_NAME = 'offlineCache'
export const DEFAULT_PURGE_AFTER_STALE = 7 * 24 * 60 * 60

/**
 * If the cache control options set the onlyIfCached directive and the request is not cached, an error will be thrown.
 */
export const NOT_CACHED_ERROR = 'Not cached'

export type CacheManagerOptions = {
    /**
     * The name of the cache key.
     */
    readonly name?: string

    /**
     * The Fetch from network method. Defaults to window.fetch.
     */
    readonly requestFromNetwork?: Fetch
}

type Fetch = (request: RequestInfo) => Promise<Response>

/**
 * A prefix for cache keys in order to guarantee they can be used as cache keys.
 * WebKit browsers only allow http/https cache keys.
 */
const CACHE_KEY_PREFIX = 'https://cache/'

/**
 * A custom header for storing the timestamp at which the entry was cached.
 */
const CACHED_TIMESTAMP_HEADER = 'X-Cached-Timestamp'

export type CacheEntryOptions = {
    /**
     * If set, the response will be cached under this identifier, not based on the request.
     * This is required for caching POST requests.
     */
    readonly cacheKey?: string | null | undefined

    /**
     * Cache control directive defaults.
     * These will be used unless overridden by the response headers or the cache control overrides.
     *
     * CacheControl directives will be overwritten in the order:
     * - cacheControlDefaults
     * - response headers
     * - cacheControlOverrides
     */
    readonly cacheControlDefaults?: CacheControl

    /**
     * Allows the client to set cache control overrides. This object is merged with the actual cache control header.
     *
     * For example, to allow cached items to be used 1 day after they are stale while asynchronously revalidating
     * the cache, set `{ staleWhileRevalidate: 24 * 60 * 60 }`
     *
     * These overrides do not change the header cached, only how the cached header is read.
     * If noStore is true, the entry will not be cached.
     */
    readonly cacheControlOverrides?: CacheControl

    /**
     * If set, checks the response if it should be used. This affects whether to cache and whether to use the
     * cached fallback.
     */
    readonly responseIsValid?: (response: Response) => Promise<boolean>
}

export type CacheCleanOptions = {
    /**
     * The number of seconds after an entry becomes stale before it should be removed from the cache.
     * Default: 7 * 24 * 60 * 60 (7 days).
     * If the cached entry has a stale-while-revalidate cache control directive, this will be ignored.
     */
    readonly purgeAfterStale?: number
}

export interface CacheManagerDeps {
    /**
     * The cache storages api.
     * Default: window.caches
     */
    readonly caches?: CacheStorage

    /**
     * Creates a Headers object
     */
    readonly headersFactory?: (headersInit?: HeadersInit) => Headers

    /**
     * Creates a Response object
     */
    readonly responseFactory?: (
        body?: BodyInit | null,
        init?: ResponseInit
    ) => Response
}

export class CacheManager {
    readonly name: string

    private readonly caches: CacheStorage
    private cache: Promise<Cache>
    private readonly fetch: Fetch

    /**
     * If set, when asynchronous caching has failed, this callback will be invoked.
     * This is not invoked when a promise rejects during an operation.
     */
    onError?: (error: Error) => void

    constructor(options?: CacheManagerOptions, deps?: CacheManagerDeps) {
        this.caches = deps?.caches ?? caches
        this.name = options?.name ?? DEFAULT_CACHE_NAME
        this.cache = this.caches.open(this.name)
        this.fetch =
            options?.requestFromNetwork ?? ((request) => fetch(request))
    }

    private readonly errorHandler = (error: Error) => {
        this.onError?.(error)
    }

    /**
     * Caches a response with added expiry headers.
     */
    async put(cacheId: RequestInfo, response: Response): Promise<Response> {
        if (response.bodyUsed)
            throw new Error(`cannot cache request, body already used`)

        const clonedResponse = response.clone()

        // Add a timestamp header
        const headers = new Headers(clonedResponse.headers)
        headers.append(CACHED_TIMESTAMP_HEADER, Date.now().toString())

        const responseWithHeader = new Response(clonedResponse.body, {
            status: clonedResponse.status,
            statusText: clonedResponse.statusText,
            headers,
        })

        const cache = await this.cache
        await cache.put(cacheId, responseWithHeader)
        return response
    }

    /**
     * Deletes the request from this cache.
     *
     * @param cacheId The request or cache id used as the cache key.
     */
    async delete(cacheId: RequestInfo): Promise<boolean> {
        const cache = await this.cache
        return await cache.delete(cacheId)
    }

    /**
     * Resolves to true if the request is cached.
     *
     * @param cacheId
     */
    async has(cacheId: RequestInfo): Promise<boolean> {
        return (await this.getCached(cacheId)) != null
    }

    async get(
        request: RequestInfo,
        options?: CacheEntryOptions
    ): Promise<Response> {
        const cache = await this.cache

        const cacheId = options?.cacheKey
            ? CACHE_KEY_PREFIX + options.cacheKey
            : request

        let cached: Response | undefined
        if (options?.cacheControlOverrides?.noStore) {
            this.delete(cacheId).catch(this.errorHandler)
            cached = undefined
        } else {
            cached = await cache.match(cacheId)
        }

        const cacheControlOptions: CacheControlOptions = {
            defaults: options?.cacheControlDefaults,
            overrides: options?.cacheControlOverrides,
        }

        const responseIsValid = async (
            response: Response
        ): Promise<boolean> => {
            return (
                response.ok &&
                (options?.responseIsValid == null ||
                    (await options.responseIsValid(response.clone())))
            )
        }

        const fetchAndMaybeCache = async (): Promise<Response> => {
            return this.fetch(request).then(async (response) => {
                const cacheControl = calculateCacheControl(
                    response,
                    cacheControlOptions
                )
                if (
                    !cacheControl.noStore &&
                    isCacheableRequestKey(cacheId) &&
                    (await responseIsValid(response))
                ) {
                    this.put(cacheId, response).catch(this.errorHandler)
                }
                return response
            })
        }
        const cacheControl = calculateCacheControl(cached, cacheControlOptions)
        const cacheBehavior = calculateCacheBehavior(
            cacheControl,
            getCachedTimestamp(cached)
        )
        if (cacheBehavior.preferCache) {
            if (cacheBehavior.reevaluate) {
                fetchAndMaybeCache().catch(this.errorHandler)
            }
            return cached!
        } else {
            if (!cacheBehavior.allowNetwork && !cached) {
                throw new Error(NOT_CACHED_ERROR)
            }
            // Prefer a network response. If the network response isn't valid, return the cached value.
            const response = await fetchAndMaybeCache().catch((error) => {
                if (!cacheBehavior.allowCache || !cached) throw error
                else return cached
            })
            const ok = await responseIsValid(response)
            return !ok ? (cached ?? response) : response
        }
    }

    /**
     * Returns a Response if it exists in cache.
     *
     * @param request
     */
    private async getCached(
        request: RequestInfo
    ): Promise<Response | undefined> {
        const cache = await this.cache
        return await cache.match(request)
    }

    /**
     * @returns a promise that resolves to true if the Cache object is found and deleted, and false otherwise.
     */
    async clear(): Promise<boolean> {
        const deleted = await this.caches.delete(this.name)
        this.cache = this.caches.open(this.name)
        return deleted
    }

    /**
     * Cleans stale items from the cache.
     */
    async clean(options?: CacheCleanOptions) {
        const cache = await this.cache
        const cacheControlOptions: CacheControlOptions = {
            defaults: {
                // Unless the cached entry has a stale-while-revalidate directive, use this default.
                staleWhileRevalidate:
                    options?.purgeAfterStale ?? DEFAULT_PURGE_AFTER_STALE,
            },
            overrides: {
                noStore: false,
            },
        }
        for (const key of await cache.keys()) {
            const cached = await cache.match(key)
            const cacheControl = calculateCacheControl(
                cached,
                cacheControlOptions
            )
            const { preferCache } = calculateCacheBehavior(
                cacheControl,
                getCachedTimestamp(cached)
            )
            if (!preferCache) {
                await cache.delete(key)
            }
        }
    }
}

type CacheControlOptions = {
    readonly defaults?: CacheControl | undefined
    readonly overrides?: CacheControl | undefined
}

function calculateCacheControl(
    cached: Response | undefined,
    options: CacheControlOptions
): CacheControl {
    const cacheControl = cached
        ? parseCacheControl(cached.headers.get('Cache-Control'))
        : {}
    return {
        ...options.defaults,
        ...cacheControl,
        ...options.overrides,
    }
}

type CacheBehavior = {
    /**
     * If false, do not use the cached entry. If it exists, delete it.
     */
    readonly allowCache: boolean

    /**
     * Prefer the cached result.
     * If false, the cache may be used if `allowCache` is true and the request fails.
     */
    readonly preferCache: boolean

    /**
     * If false, do not request from network, even if there is not a cached resource.
     */
    readonly allowNetwork: boolean

    /**
     * Load the resource from the network.
     * If preferCache is true, the cached response will be used and a new request will be made asynchronously.
     */
    readonly reevaluate: boolean
}

function calculateCacheBehavior(
    cacheControl: CacheControl,
    cachedTimestamp: number | undefined
): CacheBehavior {
    const allowCache = !(cacheControl.noStore ?? false)
    const maxAge = cacheControl.maxAge ?? 0
    const staleAt =
        maxAge * 1000 + (cachedTimestamp ?? Number.NEGATIVE_INFINITY)

    const now = Date.now()
    const isFresh = staleAt > now
    const immutable = cacheControl.immutable ?? false
    const allowNetwork = !cacheControl.onlyIfCached
    const reevaluate =
        allowNetwork && !immutable && (cacheControl.mustRevalidate || !isFresh)
    // If the entry is past its max age and there is staleWhileRevalidate set, allow the cached entry to be used
    // staleWhileRevalidate seconds after maxAge.
    const staleWhileRevalidate = cacheControl.staleWhileRevalidate ?? 0
    const preferCache =
        allowCache &&
        (isFresh || staleAt + staleWhileRevalidate * 1000 > now || immutable)
    return {
        preferCache,
        reevaluate,
        allowCache,
        allowNetwork,
    }
}

/**
 * Returns true if the request can be used as a Cache key.
 */
function isCacheableRequestKey(request: RequestInfo): boolean {
    return typeof request === 'string' || request.method === 'GET'
}

function getCachedTimestamp(cached: Response | undefined): number | undefined {
    const timestampHeader = cached?.headers.get(CACHED_TIMESTAMP_HEADER)
    if (!timestampHeader) return undefined
    return parseInt(timestampHeader, 10)
}
