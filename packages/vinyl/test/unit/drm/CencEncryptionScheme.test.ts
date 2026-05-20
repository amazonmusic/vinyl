/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseCencEncryptionScheme } from '@amazon/vinyl'

describe('parseCencEncryptionScheme', () => {
    it('returns null for invalid values', () => {
        expect(parseCencEncryptionScheme(null)).toBeNull()
        expect(parseCencEncryptionScheme('asd')).toBeNull()
    })

    it('returns parsed encryption scheme and version', () => {
        expect(parseCencEncryptionScheme('cenc')).toEqual({
            scheme: 'cenc',
            version: null,
        })
        expect(parseCencEncryptionScheme('cbcs')).toEqual({
            scheme: 'cbcs',
            version: null,
        })
        expect(parseCencEncryptionScheme('cenc:4')).toEqual({
            scheme: 'cenc',
            version: 4,
        })
        expect(parseCencEncryptionScheme('cbcs:f')).toEqual({
            scheme: 'cbcs',
            version: 15,
        })
        expect(parseCencEncryptionScheme('test')).toBeNull()
    })
})
