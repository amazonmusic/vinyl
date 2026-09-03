/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createShortUid,
    type Fetch,
    patchFetch,
    requiresPreventCacheRangeRequestsPatch,
} from '@amazon/vinyl-util'
import { vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import { expectNothing } from '@amazon/vinyl-util/browserTestUtil'

describe('requiresPreventCacheRangeRequestsPatch integ', () => {
    /** Attempts to trigger the cache range-request TypeError on this browser. */
    async function canReproduce(fetch: Fetch): Promise<boolean> {
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

    it('sets the default flag to true only if the issue can be reproduced', async () => {
        const flag = requiresPreventCacheRangeRequestsPatch()
        const reproduced = await canReproduce(window.fetch)
        if (reproduced && !flag) {
            fail(`expected the patch flag to be true`)
        } else if (!reproduced && flag) {
            // The issue rarely reproduces reliably, so a miss is only a warning.
            console.warn(`patch flag was true but the issue was not reproduced`)
        }
        expectNothing()
    })

    describe('when the patch is applied', () => {
        it('ensures range requests are reliable', async () => {
            if (
                requiresPreventCacheRangeRequestsPatch() &&
                (await canReproduce(patchFetch(window.fetch)))
            ) {
                fail('patch did not resolve issue')
            }
            expectNothing()
        })
    })
})
