/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { noop } from '@amazon/vinyl-util'

describe('noop', () => {
    it('does nothing', () => {
        expect(noop(1)).toBe(void 0)
    })
})
