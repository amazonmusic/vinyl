/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createShortUid,
    emptySignal,
    type Fetch,
    patchFetch,
    requiresPreventCacheRangeRequestsPatch,
} from '@amazon/vinyl-util'
import { vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'

import { addPatchTests } from '@amazon/vinyl-util/testUtil'

describe('requiresPreventCacheRangeRequestsPatch integ', () => {
    async function canReproduce(fetch: Fetch) {
        const cacheBust = createShortUid()
        for (let i = 0; i < 2; i++) {
            for (const range of ['826-929', '0-825', '930-50160']) {
                try {
                    await fetch(
                        vinylTestAssets.prog
                            .libmp3lame_60s_2ch_16bit_44100Hz_48kbps +
                            `?cache=${cacheBust}`,
                        {
                            headers: {
                                Range: `bytes=${range}`,
                            },
                        }
                    )
                } catch (e) {
                    if (e instanceof TypeError) {
                        return true
                    }
                }
            }
        }
        return false
    }

    addPatchTests(
        'requiresPreventCacheRangeRequestsPatch',
        'ensures range requests are reliable',
        () => ({
            target: window.fetch,
            canReproduce,
            actualFlag: requiresPreventCacheRangeRequestsPatch(),
            patchedRef: {
                patched: patchFetch(window.fetch),
                eventFabricated: emptySignal,
                eventSquelched: emptySignal,
                dispose() {},
            },
            allowFalseNegative: true,
        })
    )
})
