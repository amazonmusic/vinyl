/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getLogLevelFromSearch, LogLevel } from '@amazon/vinyl-util'

describe('getLogLevelFromSearch', () => {
    it('uses the vinylLogLevel querystring', () => {
        expect(getLogLevelFromSearch('?vinylLogLevel=warn')).toBe(LogLevel.WARN)
    })

    it('uses the default if no match', () => {
        expect(getLogLevelFromSearch('')).toBe(LogLevel.WARN)
        expect(getLogLevelFromSearch('', LogLevel.ERROR)).toBe(LogLevel.ERROR)
        expect(
            getLogLevelFromSearch('?vinylLogLevel=unknown', LogLevel.ERROR)
        ).toBe(LogLevel.ERROR)
    })
})
