/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AbrStrategy,
    DrmKeySystem,
    supportsMse,
    type VinylPlayer,
    type VinylPlayerEventMap,
} from '@amazon/vinyl'
import type {
    Maybe,
    RequestInitOptions,
    RequestOptions,
} from '@amazon/vinyl-util'
import {
    createRequester,
    networkState,
    noop,
    type Requester,
    RequestError,
    requesterWithRetryRef,
    RequestFailureType,
    RetryStrategy,
    sleep,
} from '@amazon/vinyl-util'
import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'

import {
    createEventSpy,
    emptyRequestInfo,
    type EventSpy,
    MockNetworkState,
    overrideGlobalInit,
} from '@amazon/vinyl-util/testUtil'
import { mockEvent } from '@amazon/vinyl-util/browserTestUtil'
import { pendingIfWidevineNotSupported } from '../drm/pendingIfWidevineNotSupported'
import { expectTrackPlaysUntil } from '../../vinylTestUtil/util/playback/expectTrackPlaysUntil'
import { normalizeHeadersInit } from '@amazon/vinyl-util'

const playbackTime = 5

describe('reset integ', () => {
    overrideGlobalInit(requesterWithRetryRef, () => {
        const requester = createRequester({
            retryOptions: RetryStrategy.ONE_RETRY,
        })
        const originalRequest = requester.request.bind(requester)
        spyOn(requester, 'request').and.callFake(
            async (
                input: RequestInfo | Readonly<URL>,
                init?: Maybe<RequestInitOptions>,
                requestOptions?: Maybe<RequestOptions>
            ) => {
                if (!requestGate(input, init, requestOptions)) {
                    await sleep(0.1)
                    throw new RequestError(null, {
                        ok: false,
                        type: RequestFailureType.INTERNAL,
                        willRetry: false,
                        retryAfter: null,
                        reason: null,
                        timestamp: Date.now(),
                        requestInfo: {
                            ...emptyRequestInfo,
                            init: init ?? emptyRequestInfo.init,
                            input,
                        },
                    })
                }
                return originalRequest(input, init, requestOptions)
            }
        )

        return requester
    })

    let mockNetworkState: MockNetworkState
    const mockNetworkStateRef = overrideGlobalInit(
        networkState,
        () => new MockNetworkState()
    )

    const suite = createVinylSuite(
        {
            drm: {
                keySystems: {
                    [DrmKeySystem.WIDEVINE]: {
                        licenseServer: {
                            url: 'https://cwip-shaka-proxy.appspot.com/no_auth',
                        },
                    },
                },
            },
        },
        {
            // Do not fail the suite on caught errors, this suite tests failures
            failOnError: false,
        }
    )
    let player: VinylPlayer
    let errorSpy: EventSpy<VinylPlayerEventMap, 'error'>
    let resetSpy: EventSpy<VinylPlayerEventMap, 'reset'>
    let fetchedRangesChangeSpy: EventSpy<
        VinylPlayerEventMap,
        'fetchedRangesChange'
    >
    let requestGate: (...args: Parameters<Requester['request']>) => boolean
    let failNext: boolean

    beforeEach(() => {
        mockNetworkState = mockNetworkStateRef.value
        mockNetworkState.onLine = true
        failNext = false
        requestGate = () => {
            if (failNext) {
                failNext = false
                return false
            }
            return true
        }
        player = suite.player
        errorSpy = createEventSpy(player, 'error')
        resetSpy = createEventSpy(player, 'reset')
        fetchedRangesChangeSpy = createEventSpy(player, 'fetchedRangesChange')
        player.configure({
            abr: {
                // These tests aren't relevant to ABR, save bandwidth:
                strategy: AbrStrategy.LOWEST,
            },
        })
    })

    describe('on dash tracks', () => {
        beforeEach(() => {
            if (!supportsMse()) {
                pending('MSE not supported')
                return
            }
        })

        function loadDash() {
            player.load({
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase,
            })
        }

        it('recovers from failed segment prefetch', async () => {
            // A failed prefetch that does not affect buffering is expected to be
            // retried at the time it's needed for buffering
            loadDash()
            const playPromise = player.play()
            while (player.fetchedTime < 29) {
                await fetchedRangesChangeSpy.next(15)
            }
            failNext = true // fail the segment at 30-40s
            await playPromise
            await sleep(3) // give the prefetch time to fail
            expect(player.fetchedTime).toBeLessThan(31)
            // Seek to the failed segment to assert that it's retried without
            // waiting for the reset interval or an online event.
            const seekToTime = 32
            player.seekTo(seekToTime).catch(noop)
            await expectTrackPlaysUntil(player, seekToTime + playbackTime)
            expect(errorSpy)
                .withContext('prefetch failures should not cause player errors')
                .not.toHaveBeenCalled()
        })

        const requestOrderFailures = [
            {
                label: 'manifest',
                contentLengthRange: undefined,
            },
            {
                label: 'sidx segment',
                contentLengthRange: [50, 400],
            },
            {
                label: 'index segment',
                contentLengthRange: [700, 2000], // ~1KiB
            },
            {
                label: 'media segment',
                contentLengthRange: [20000, Infinity], // ~60KiB
            },
        ] as const

        for (let i = 0; i < requestOrderFailures.length; i++) {
            const { label, contentLengthRange } = requestOrderFailures[i]
            it(`recovers next onLine for ${label} errors`, async () => {
                requestGate = (_, init) => {
                    const headers = normalizeHeadersInit(init?.headers ?? {})
                    const rangeHeader = headers.Range
                    if (!rangeHeader) return !!contentLengthRange
                    if (!contentLengthRange) return true
                    const [start, end] = rangeHeader
                        .slice(6)
                        .split('-')
                        .map(Number)
                    const contentLength = end - start + 1
                    return (
                        contentLength < contentLengthRange[0] ||
                        contentLength > contentLengthRange[1]
                    )
                }
                const nextError = errorSpy.next(30)
                loadDash()
                const playPromise = player.play()
                await nextError
                requestGate = () => true
                const nextReset = resetSpy.next(1)
                mockNetworkState.dispatch('online', mockEvent('online'))
                await nextReset
                await playPromise
                await expectTrackPlaysUntil(player, playbackTime)
            })
        }

        describe('when encrypted', () => {
            beforeEach(async () => {
                await pendingIfWidevineNotSupported(player)
            })

            it('recovers from failed license requests', async () => {
                const nextError = errorSpy.next(30)

                let licenseAttempt = 0

                requestGate = (input: RequestInfo | Readonly<URL>) => {
                    if (
                        typeof input === 'string' &&
                        input === 'https://cwip-shaka-proxy.appspot.com/no_auth'
                    ) {
                        return licenseAttempt++ > 0
                    }
                    return true
                }

                player.load({
                    type: 'dash',
                    uri: vinylTestAssets.dash
                        .live_static_aac_opus_flac_60s_segmentBase_widevine,
                })

                const playPromise = player.play()
                await nextError
                const nextReset = resetSpy.next(1)
                mockNetworkState.dispatch('online', mockEvent('online'))
                await nextReset
                await playPromise
                await expectTrackPlaysUntil(player, playbackTime)
            })
        })
    })
})
