/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CacheManager,
    DEFAULT_PURGE_AFTER_STALE,
    NOT_CACHED_ERROR,
} from '@amazon/vinyl-cache-manager'
import {
    flushPromises,
    MockCacheStorage,
} from '@amazon/vinyl-util/browserTestUtil'
import { MockCache } from '@amazon/vinyl-util/browserTestUtil'
import Spy = jasmine.Spy
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining

describe('CacheManager', () => {
    let mockCache: MockCache
    let mockCaches: MockCacheStorage
    let fetchSpy: Spy
    let manager: CacheManager

    let mockRequest: Request
    let mockResponse: Response
    let staleResponse: Response

    beforeEach(() => {
        mockCache = new MockCache()
        mockCaches = new MockCacheStorage()
        mockCaches.open.and.returnValue(Promise.resolve(mockCache))

        fetchSpy = jasmine
            .createSpy('fetch')
            .and.callFake(() => Promise.resolve(mockResponse))

        manager = new CacheManager(
            {
                name: 'test-cache',
                requestFromNetwork: fetchSpy,
            },
            {
                caches: mockCaches,
            }
        )

        manager.onError = fail

        mockRequest = new Request('https://example.com/resource', {
            method: 'GET',
        })

        mockResponse = new Response('', {
            headers: {
                'Cache-Control': 'max-age=60',
            },
        })

        staleResponse = new Response('', {
            headers: {
                'Cache-Control': 'max-age=0',
            },
        })
    })

    describe('constructor', () => {
        beforeEach(() => {
            if (typeof process === 'undefined')
                pending('requires NODE environment')
            else {
                ;(global as any).caches = mockCaches
            }
        })

        afterEach(() => {
            if (typeof process === 'undefined') {
                delete (global as any).caches
            }
        })

        it('uses global caches and fetch when not provided', async () => {
            const fetchSpy = spyOn(global, 'fetch').and.callFake(() =>
                Promise.resolve(mockResponse)
            )
            mockCaches.open.calls.reset()
            manager = new CacheManager()
            expect(manager.name).toBe('offlineCache')
            expect(mockCaches.open).toHaveBeenCalledTimes(1)
            await manager.get(mockRequest)
            expect(fetchSpy).toHaveBeenCalled()
        })
    })

    describe('get', () => {
        it('caches and retrieves a response', async () => {
            mockCache.match.and.resolveTo(undefined)

            const result = await manager.get(mockRequest)
            expect(fetchSpy).toHaveBeenCalled()
            expect(result).toBe(mockResponse)
            expect(mockCache.put).toHaveBeenCalled()
        })

        it('uses a cached response if still fresh', async () => {
            const now = Date.now()
            mockResponse.headers.append('X-Cached-Timestamp', now.toString())
            mockCache.match.and.returnValue(Promise.resolve(mockResponse))

            const result = await manager.get(mockRequest)
            expect(result).toBe(mockResponse)
            expect(fetchSpy).not.toHaveBeenCalled()
        })

        it('revalidates in background if staleWhileRevalidate is set', async () => {
            const now = Date.now() - 1000
            staleResponse.headers.append('X-Cached-Timestamp', now.toString())
            mockCache.match.and.returnValue(Promise.resolve(staleResponse))

            await manager.get(mockRequest, {
                cacheControlOverrides: { staleWhileRevalidate: 3600 },
            })

            expect(fetchSpy).toHaveBeenCalled()
        })

        it('throws if onlyIfCached is set and no cached response', async () => {
            mockCache.match.and.resolveTo(undefined)

            await expectAsync(
                manager.get(mockRequest, {
                    cacheControlOverrides: { onlyIfCached: true },
                })
            ).toBeRejectedWithError(NOT_CACHED_ERROR)
        })

        it('does not cache if noStore is set', async () => {
            mockCache.match.and.resolveTo(undefined)

            await manager.get(mockRequest, {
                cacheControlOverrides: { noStore: true },
            })
            expect(mockCache.put).not.toHaveBeenCalled()
        })

        it('uses cacheKey for POST-like request', async () => {
            const mockCacheKey = 'custom-key'
            mockCache.match.and.resolveTo(undefined)

            await manager.get(mockRequest, {
                cacheKey: mockCacheKey,
            })

            expect(fetchSpy).toHaveBeenCalled()
            expect(mockCache.put).toHaveBeenCalled()
        })

        it('uses responseIsValid to skip invalid network response', async () => {
            const now = Date.now() - 1000
            staleResponse.headers.append('X-Cached-Timestamp', now.toString())
            mockCache.match.and.returnValue(Promise.resolve(staleResponse))

            const invalidResponse = new Response('bad', { status: 500 })
            fetchSpy.and.returnValue(Promise.resolve(invalidResponse))

            const result = await manager.get(mockRequest, {
                cacheControlOverrides: { staleWhileRevalidate: 60 },
                responseIsValid: (res) => Promise.resolve(res.status === 200),
            })

            expect(result).toBe(staleResponse)
        })

        describe('when responseIsValid is set', () => {
            it('uses responseIsValid to reject a fresh network response', async () => {
                mockCache.match.and.returnValue(Promise.resolve(undefined))

                // Simulate responseIsValid returning false
                const invalidResponse = new Response('bad', { status: 200 })
                fetchSpy.and.returnValue(Promise.resolve(invalidResponse))

                const result = await manager.get(mockRequest, {
                    responseIsValid: () => Promise.resolve(false),
                })

                expect(result).toBe(invalidResponse)
                expect(mockCache.put).not.toHaveBeenCalled()
            })
        })

        describe('when the fetch impl reads the request body', () => {
            it('notifies onError handler', async () => {
                fetchSpy.and.callFake(async () => {
                    await mockResponse.text()
                    return mockResponse
                })
                const errorSpy = createSpy('onError')
                manager.onError = errorSpy
                await manager.get(mockRequest)
                await flushPromises()
                expect(errorSpy).toHaveBeenCalledOnceWith(
                    objectContaining({
                        message: 'cannot cache request, body already used',
                    })
                )
            })
        })

        describe('and network response is not ok', () => {
            describe('when cache is allowed', () => {
                it('falls back to cache', async () => {
                    const now = Date.now() - 1000
                    staleResponse.headers.append(
                        'X-Cached-Timestamp',
                        now.toString()
                    )
                    mockCache.match.and.returnValue(
                        Promise.resolve(staleResponse)
                    )

                    fetchSpy.and.returnValue(
                        Promise.reject(new Error('offline'))
                    )
                    const result = await manager.get(mockRequest)

                    expect(result).toBe(staleResponse)
                })

                it('rejects if not cached', async () => {
                    const response = new Response('bad', { status: 500 })
                    fetchSpy.and.resolveTo(response)
                    const result = await manager.get(mockRequest)
                    expect(result).toBe(response)
                })
            })
        })

        describe('and fetch rejects', () => {
            describe('when cache is not allowed', () => {
                it('does not attempt to access cache', async () => {
                    fetchSpy.and.rejectWith(new Error('offline'))
                    await expectAsync(
                        manager.get(mockRequest, {
                            cacheControlOverrides: { noStore: true },
                        })
                    ).toBeRejectedWithError('offline')
                    expect(mockCaches.match).not.toHaveBeenCalled()
                })
            })
        })
    })

    describe('delete', () => {
        it('deletes an entry', async () => {
            mockCache.delete.and.returnValue(Promise.resolve(true))
            const deleted = await manager.delete(mockRequest)
            expect(deleted).toBeTrue()
        })
    })

    describe('has', () => {
        it('checks existence of cached response', async () => {
            mockCache.match.and.returnValue(Promise.resolve(undefined))
            const result = await manager.has(mockRequest)
            expect(result).toBeFalse()
        })
    })

    describe('clear', () => {
        it('clears the cache', async () => {
            mockCaches.delete.and.returnValue(Promise.resolve(true))
            const result = await manager.clear()
            expect(result).toBeTrue()
            expect(mockCaches.delete).toHaveBeenCalledWith('test-cache')
        })
    })

    describe('clean', () => {
        it('cleans stale entries', async () => {
            const entry = new Request('https://example.com/resource')
            const now = Date.now() - 1000
            staleResponse.headers.append('X-Cached-Timestamp', now.toString())
            mockCache.keys.and.returnValue(Promise.resolve([entry]))
            mockCache.match.and.returnValue(Promise.resolve(staleResponse))
            mockCache.delete.and.returnValue(Promise.resolve(true))

            await manager.clean({ purgeAfterStale: 0 })

            expect(mockCache.delete).toHaveBeenCalledWith(entry)
        })

        it('does not delete fresh entries during clean', async () => {
            const entry = new Request('https://example.com/resource')
            mockResponse.headers.append(
                'X-Cached-Timestamp',
                Date.now().toString()
            )
            mockCache.keys.and.returnValue(Promise.resolve([entry]))
            mockCache.match.and.returnValue(Promise.resolve(mockResponse))

            await manager.clean({ purgeAfterStale: 60 })

            expect(mockCache.delete).not.toHaveBeenCalled()
        })

        it('uses 7 weeks for purgeAfterStale value', async () => {
            const entry = new Request('https://example.com/resource')
            staleResponse.headers.set(
                'X-Cached-Timestamp',
                (Date.now() - (DEFAULT_PURGE_AFTER_STALE - 1) * 1000).toString()
            )
            mockCache.keys.and.returnValue(Promise.resolve([entry]))
            mockCache.match.and.returnValue(Promise.resolve(staleResponse))

            await manager.clean()
            expect(mockCache.delete).not.toHaveBeenCalled()

            staleResponse.headers.set(
                'X-Cached-Timestamp',
                (
                    Date.now() -
                    DEFAULT_PURGE_AFTER_STALE * 1000 -
                    1000
                ).toString()
            )
            await manager.clean()
            expect(mockCache.delete).toHaveBeenCalled()
        })
    })

    it('invokes onError when async cache fails', async () => {
        const now = Date.now() - 1000
        staleResponse.headers.append('X-Cached-Timestamp', now.toString())
        mockCache.match.and.returnValue(Promise.resolve(staleResponse))

        const error = new Error('put failed')
        spyOn(manager, 'put').and.rejectWith(error)

        const onErrorSpy = jasmine.createSpy('onError')
        manager.onError = onErrorSpy

        await manager.get(mockRequest, {
            cacheControlOverrides: { staleWhileRevalidate: 3600 },
        })
        await flushPromises()
        expect(onErrorSpy).toHaveBeenCalledWith(error)
    })
})
