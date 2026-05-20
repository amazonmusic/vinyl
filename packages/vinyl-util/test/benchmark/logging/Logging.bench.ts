/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogTarget } from '@amazon/vinyl-util'
import { logDebug } from '@amazon/vinyl-util'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { addBenchmarks, setupBenchmark } from '@/setup'

describe('Logging', () => {
    setupBenchmark()

    it('logDebug', async () => {
        const target: LogTarget = {
            logPrefix: 'path',
        }
        const results = await benchmark(`logDebug`, () => {
            logDebug(target, {
                requestInfo: {
                    fetchId: 'lgn9lrwaid8o3utd5r',
                    init: {
                        method: 'POST',
                        headers: {
                            'Content-Encoding': 'amz-1.0',
                            'Content-Type': 'application/json',
                            'X-Amz-Target':
                                'com.amazon.digitalmusiclocator.DigitalMusicLocatorServiceExternal.getStreamingURLs',
                        },
                        body: '{"contentIdList":[{"identifier":"d9e4e337-97ba-41a9-9f31-84a8bf99f1dc","identifierType":"COID"}],"bitRate":"HIGH","deviceToken":{"deviceId":"lg4msezd1e355heuc5b","deviceTypeId":"A16ZV8BU3SN1N3"},"appMetadata":{"appId":"WebCP","https":true,"appVersion":"1.0.0"},"clientMetadata":{"clientId":"WebCP","clientRequestId":"lgn9lrw623mgvi7k3et"}}',
                        signal: '[object AbortSignal]',
                    },
                    input: 'https://example.com/bar/',
                    maxRetries: 1,
                    timestamp: new Date('2023-04-19T05:40:17.914Z'),
                    fetchOptions: {
                        serviceId: null,
                        readErrorBody: 1,
                    },
                },
                attemptInfo: {
                    currentTry: 1,
                    timestamp: new Date('2023-04-19T05:40:17.914Z'),
                },
                target: '[object FetchProviderImpl]',
            })
        })
        addBenchmarks('logDebug', results)
    })
})
