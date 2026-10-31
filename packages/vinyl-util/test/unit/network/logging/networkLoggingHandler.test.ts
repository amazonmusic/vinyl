/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { clone, ErrorBodyType, networkLoggingHandler } from '@amazon/vinyl-util'
import {
    emptyRequestSuccessEvent,
    MockRequester,
    useMockLogger,
} from '@amazon/vinyl-util/testUtil'
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('networkLoggingHandler', () => {
    const loggerRef = useMockLogger()
    let requester: MockRequester

    beforeEach(() => {
        requester = new MockRequester()
    })

    it('logs requestAttemptStart events', () => {
        const event = clone(emptyRequestSuccessEvent)
        event.requestInfo = {
            input: 'https://example.com',
            init: {},
            maxRetries: 1,
            timestamp: 32,
            requestOptions: {
                readErrorBody: ErrorBodyType.DISABLED,
                serviceId: null,
            },
            requestId: 'request-id',
        }
        const handle = networkLoggingHandler(requester)
        requester.dispatch('requestAttemptStart', event)
        expect(loggerRef.value.debug).toHaveBeenCalledWith(
            handle.target,
            'requestAttemptStart',
            null,
            objectContaining({
                requestInfo: {
                    url: 'https://example.com',
                    requestId: 'request-id',
                    maxRetries: 1,
                    timestamp: 32,
                    requestOptions: {
                        readErrorBody: ErrorBodyType.DISABLED,
                        serviceId: null,
                    },
                },
                attemptInfo: event.attemptInfo,
            })
        )
    })

    it('truncates service id', () => {
        const event = clone(emptyRequestSuccessEvent)
        event.requestInfo.requestOptions.serviceId =
            'this is a very long service id that will be truncated'
        networkLoggingHandler(requester)
        requester.dispatch('requestAttemptStart', event)
        expect(loggerRef.value.debug).toHaveBeenCalledWith(
            any(Object),
            'requestAttemptStart',
            'this is a very long…',
            any(Object)
        )
    })

    it('logs url from the request input', () => {
        const event = clone(emptyRequestSuccessEvent)
        event.requestInfo.input = new URL('https://example.org')
        networkLoggingHandler(requester)
        requester.dispatch('requestAttemptStart', event)
        expect(loggerRef.value.debug).toHaveBeenCalledWith(
            any(Object),
            'requestAttemptStart',
            null,
            objectContaining({
                requestInfo: objectContaining({
                    url: 'https://example.org/',
                }),
            })
        )
        loggerRef.value.debug.calls.reset()

        event.requestInfo.input = new Request('https://example.com/test1.html')
        requester.dispatch('requestAttemptStart', event)
        expect(loggerRef.value.debug).toHaveBeenCalledWith(
            any(Object),
            'requestAttemptStart',
            null,
            objectContaining({
                requestInfo: objectContaining({
                    url: 'https://example.com/test1.html',
                }),
            })
        )

        event.requestInfo.input = new Request(
            new URL('https://example.com/test2.html')
        )
        requester.dispatch('requestAttemptStart', event)
        expect(loggerRef.value.debug).toHaveBeenCalledWith(
            any(Object),
            'requestAttemptStart',
            null,
            objectContaining({
                requestInfo: objectContaining({
                    url: 'https://example.com/test2.html',
                }),
            })
        )
    })

    it('logs requestAttemptComplete events with debug severity', () => {
        const event = clone(emptyRequestSuccessEvent)
        event.requestInfo.timestamp = 3
        event.requestInfo.input = 'https://example.org'
        event.timestamp = 32
        event.ok = true
        const handle = networkLoggingHandler(requester)
        requester.dispatch('requestAttemptComplete', event)
        expect(loggerRef.value.debug).toHaveBeenCalledWith(
            handle.target,
            'requestAttemptComplete',
            null,
            {
                ok: true,
                timestamp: 32,
                durationMs: 29, // 32 - 3
                requestInfo: objectContaining({
                    url: 'https://example.org',
                }),
            }
        )
    })

    it('masks secret query values in the logged url', () => {
        const event = clone(emptyRequestSuccessEvent)
        event.requestInfo.input =
            'https://example.com/auth?code=abc123&refresh_token=r-secret&access_token=a-secret&id_token=i-secret&code_verifier=v-secret&client_secret=c-secret&keep=yes'
        networkLoggingHandler(requester)
        requester.dispatch('requestAttemptStart', event)
        requester.dispatch('requestAttemptComplete', event)
        const urls = loggerRef.value.debug.calls
            .allArgs()
            .map(
                (args) =>
                    (args[3] as { requestInfo: { url: string } }).requestInfo
                        .url
            )
        expect(urls.length).toBe(2)
        for (const url of urls) {
            expect(url).toBe(
                'https://example.com/auth?code=[redacted]&refresh_token=[redacted]&access_token=[redacted]&id_token=[redacted]&code_verifier=[redacted]&client_secret=[redacted]&keep=yes'
            )
        }
    })

    it('masks secrets when the input is a URL or a Request', () => {
        const event = clone(emptyRequestSuccessEvent)
        networkLoggingHandler(requester)
        event.requestInfo.input = new URL('https://example.com/a?code=abc123')
        requester.dispatch('requestAttemptStart', event)
        event.requestInfo.input = new Request(
            'https://example.com/b?refresh_token=r-secret'
        )
        requester.dispatch('requestAttemptStart', event)
        const logged = JSON.stringify(loggerRef.value.debug.calls.allArgs())
        expect(logged).not.toContain('abc123')
        expect(logged).not.toContain('r-secret')
    })
})
