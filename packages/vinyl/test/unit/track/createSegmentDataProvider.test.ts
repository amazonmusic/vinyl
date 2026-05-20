/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createSegmentDataProvider,
    type CreateSegmentDataProviderDeps,
} from '@amazon/vinyl'
import {
    Abort,
    networkMetricsController,
    requesterWithRetryRef,
} from '@amazon/vinyl-util'
import {
    MockNetworkMetricsController,
    MockRequester,
    overrideGlobalInit,
} from '@amazon/vinyl-util/testUtil'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'

import createSpy = jasmine.createSpy
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('createSegmentDataProvider', () => {
    let mockRequester: MockRequester
    let deps: CreateSegmentDataProviderDeps

    const mockRequesterRef = overrideGlobalInit(
        requesterWithRetryRef,
        () => new MockRequester()
    )

    const networkMetricsControllerRef = overrideGlobalInit(
        networkMetricsController,
        () => new MockNetworkMetricsController()
    )

    const clock = useMockTime()

    beforeEach(() => {
        mockRequester = mockRequesterRef.value
        mockRequester.request.and.resolveTo(new Response(new ArrayBuffer(100)))
        deps = {
            requestInterceptor: createSpy('requestInterceptor'),
            segmentRequestInit: undefined,
        }
    })

    it('returns a function', () => {
        const provider = createSegmentDataProvider(deps, {
            url: 'https://example.com/seg0.mp4',
            reportDownlinkMetrics: false,
        })
        expect(provider).toEqual(any(Function))
    })

    it('fetches the segment URL and returns an ArrayBuffer', async () => {
        const provider = createSegmentDataProvider(deps, {
            url: 'https://example.com/seg0.mp4',
            reportDownlinkMetrics: false,
        })
        const result = await provider()
        expect(result).toEqual(any(ArrayBuffer))
        expect(mockRequester.request).toHaveBeenCalledTimes(1)
    })

    describe('when mediaRange is provided', () => {
        it('adds Range header', async () => {
            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                mediaRange: [100, 299],
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toEqual(
                objectContaining({ Range: 'bytes=100-299' })
            )
        })
    })

    describe('when mediaRange is not provided', () => {
        it('does not add Range header', async () => {
            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toBeUndefined()
        })
    })

    it('calls the request interceptor', async () => {
        const provider = createSegmentDataProvider(deps, {
            url: 'https://example.com/seg0.mp4',
            reportDownlinkMetrics: false,
        })
        await provider()
        expect(deps.requestInterceptor).toHaveBeenCalledTimes(1)
    })

    describe('segmentRequestInit', () => {
        it('applies segmentRequestInit properties to the request', async () => {
            const depsWithInit: CreateSegmentDataProviderDeps = {
                ...deps,
                segmentRequestInit: { headers: { 'X-Custom': 'value' } },
            }
            const provider = createSegmentDataProvider(depsWithInit, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toEqual(
                objectContaining({ 'X-Custom': 'value' })
            )
        })

        it('merges segmentRequestInit headers with Range header', async () => {
            const depsWithInit: CreateSegmentDataProviderDeps = {
                ...deps,
                segmentRequestInit: { headers: { 'X-Custom': 'value' } },
            }
            const provider = createSegmentDataProvider(depsWithInit, {
                url: 'https://example.com/seg0.mp4',
                mediaRange: [0, 99],
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toEqual({
                'X-Custom': 'value',
                Range: 'bytes=0-99',
            })
        })

        it('does not allow segmentRequestInit to override Range header', async () => {
            const depsWithInit: CreateSegmentDataProviderDeps = {
                ...deps,
                segmentRequestInit: {
                    headers: { Range: 'bytes=999-9999' },
                },
            }
            const provider = createSegmentDataProvider(depsWithInit, {
                url: 'https://example.com/seg0.mp4',
                mediaRange: [0, 99],
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toEqual(
                objectContaining({ Range: 'bytes=0-99' })
            )
        })

        it('normalizes Headers object before merging with Range', async () => {
            const depsWithInit: CreateSegmentDataProviderDeps = {
                ...deps,
                segmentRequestInit: {
                    headers: new Headers({ 'X-Custom': 'value' }),
                },
            }
            const provider = createSegmentDataProvider(depsWithInit, {
                url: 'https://example.com/seg0.mp4',
                mediaRange: [0, 99],
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toEqual(
                objectContaining({
                    'x-custom': 'value',
                    Range: 'bytes=0-99',
                })
            )
        })

        it('normalizes array headers before merging with Range', async () => {
            const depsWithInit: CreateSegmentDataProviderDeps = {
                ...deps,
                segmentRequestInit: {
                    headers: [['X-Custom', 'value']],
                },
            }
            const provider = createSegmentDataProvider(depsWithInit, {
                url: 'https://example.com/seg0.mp4',
                mediaRange: [0, 99],
                reportDownlinkMetrics: false,
            })
            await provider()
            const interceptorCall = deps.requestInterceptor as jasmine.Spy
            const params = interceptorCall.calls.argsFor(0)[0]
            expect(params.init.headers).toEqual(
                objectContaining({
                    'X-Custom': 'value',
                    Range: 'bytes=0-99',
                })
            )
        })
    })

    it('passes abort to the request', async () => {
        const provider = createSegmentDataProvider(deps, {
            url: 'https://example.com/seg0.mp4',
            reportDownlinkMetrics: false,
        })
        const abort = new Abort()
        await provider(abort)
        expect(mockRequester.request.calls.argsFor(0)[2]).toEqual(
            objectContaining({ abort })
        )
    })

    describe('serviceId', () => {
        it('uses serviceId when provided', async () => {
            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                serviceId: 'my-service',
                reportDownlinkMetrics: false,
            })
            await provider()
            expect(mockRequester.request.calls.argsFor(0)[2]).toEqual(
                objectContaining({ serviceId: 'my-service' })
            )
        })

        it('falls back to hostname when serviceId is not provided', async () => {
            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: false,
            })
            await provider()
            expect(mockRequester.request.calls.argsFor(0)[2]).toEqual(
                objectContaining({ serviceId: 'example.com' })
            )
        })
    })

    describe('when reportDownlinkMetrics is true', () => {
        it('reports transfer entry to network metrics controller', async () => {
            const mockBuffer = new ArrayBuffer(1234)
            const response = new Response(mockBuffer)
            mockRequester.request.and.resolveTo(response)

            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: true,
            })
            const promise = provider()
            await clock.tick(2)
            await promise
            expect(
                networkMetricsControllerRef.value.addDownlinkTransferEntry
            ).toHaveBeenCalledOnceWith(
                objectContaining({
                    bytes: 1234,
                    serviceId: 'example.com',
                })
            )
        })
    })

    describe('when reportDownlinkMetrics is false', () => {
        it('does not report transfer entry', async () => {
            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: false,
            })
            await provider()
            expect(
                networkMetricsControllerRef.value.addDownlinkTransferEntry
            ).not.toHaveBeenCalled()
        })
    })

    describe('responseStart from resource timing', () => {
        it('uses performance resource timing responseStart when available', async () => {
            const mockBuffer = new ArrayBuffer(500)
            const response = new Response(mockBuffer)
            mockRequester.request.and.resolveTo(response)

            // Mock performance.getEntriesByName
            const mockEntry = { responseStart: 100 }
            spyOn(performance, 'getEntriesByName').and.returnValue([
                mockEntry as any,
            ])

            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: true,
            })
            await provider()
            expect(
                networkMetricsControllerRef.value.addDownlinkTransferEntry
            ).toHaveBeenCalledOnceWith(
                objectContaining({
                    responseStart: performance.timeOrigin + 100,
                })
            )
        })

        it('sets responseStart to null when resource timing responseStart is 0', async () => {
            const mockBuffer = new ArrayBuffer(500)
            const response = new Response(mockBuffer)
            mockRequester.request.and.resolveTo(response)

            const mockEntry = { responseStart: 0 }
            spyOn(performance, 'getEntriesByName').and.returnValue([
                mockEntry as any,
            ])

            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: true,
            })
            await provider()
            expect(
                networkMetricsControllerRef.value.addDownlinkTransferEntry
            ).toHaveBeenCalledOnceWith(
                objectContaining({
                    responseStart: null,
                })
            )
        })

        it('sets responseStart to null when no resource timing entries exist', async () => {
            const mockBuffer = new ArrayBuffer(500)
            const response = new Response(mockBuffer)
            mockRequester.request.and.resolveTo(response)

            spyOn(performance, 'getEntriesByName').and.returnValue([])

            const provider = createSegmentDataProvider(deps, {
                url: 'https://example.com/seg0.mp4',
                reportDownlinkMetrics: true,
            })
            await provider()
            expect(
                networkMetricsControllerRef.value.addDownlinkTransferEntry
            ).toHaveBeenCalledOnceWith(
                objectContaining({
                    responseStart: null,
                })
            )
        })
    })
})
