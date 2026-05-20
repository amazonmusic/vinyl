/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { logTimer, LogLevel, loggerRef } from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('logTimer', () => {
    const clock = useMockTime()
    useMockLogger()

    it('logs elapsed time when returned function is called', async () => {
        const target = { logPrefix: 'test' }
        const message = 'operation completed'

        const endTimer = logTimer(target, message)

        await clock.tick(1.5) // Advance time by 1.5 seconds

        endTimer()

        expect(loggerRef.value.log).toHaveBeenCalledWith(
            target,
            LogLevel.DEBUG,
            message,
            '1500ms'
        )
    })
})
