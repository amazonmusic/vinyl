/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DescriptorRecord, getDescriptorValue } from '@amazon/vinyl'

describe('getDescriptorValue', () => {
    it('returns null when the URI does not exist in the record', () => {
        expect(getDescriptorValue({}, 'nonexistent-uri')).toBeNull()
    })

    it('returns null when no descriptors match the given id', () => {
        const record: DescriptorRecord = {
            'test-uri': [
                { id: '1', value: 'value1' },
                { id: '2', value: 'value2' },
            ],
        }
        expect(
            getDescriptorValue(record, 'test-uri', 'nonexistent-id')
        ).toBeNull()
    })

    it('returns the value of the first descriptor when id is not provided', () => {
        const record: DescriptorRecord = {
            'test-uri': [
                { id: '1', value: 'value1' },
                { id: '2', value: 'value2' },
            ],
        }
        expect(getDescriptorValue(record, 'test-uri')).toBe('value1')
    })

    it('returns the value of the descriptor that matches the given id', () => {
        const record: DescriptorRecord = {
            'test-uri': [
                { id: '1', value: 'value1' },
                { id: '2', value: 'value2' },
            ],
        }
        expect(getDescriptorValue(record, 'test-uri', '2')).toBe('value2')
    })
})
