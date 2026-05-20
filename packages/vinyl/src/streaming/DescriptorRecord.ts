/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    array,
    object,
    type ObjectSchema,
    record,
    type RecordSchema,
    string,
} from '@amazon/vinyl-validation'
import { first, type Maybe, type ReadonlyRecord } from '@amazon/vinyl-util'
import { type Uri } from '@amazon/vinyl-xml'

/**
 * A map of scheme URIs to a descriptor list.
 */
export type DescriptorRecord = ReadonlyRecord<
    Uri,
    readonly Descriptor[] | undefined
>

/**
 * A generic descriptor providing extended information.
 */
export interface Descriptor {
    /**
     * An optional unique identifier for the descriptor.
     */
    readonly id?: Maybe<string>

    /**
     * An optional value associated with the descriptor, whose interpretation depends on the scheme.
     */
    readonly value?: Maybe<string>
}

/**
 * Gets The first matching descriptor value from a record with a matching URI and optional id.
 *
 * @param record The descriptor record.
 * @param uri The URI key.
 * @param id An optional id. If provided the descriptor must have a matching id.
 */
export function getDescriptorValue(
    record: DescriptorRecord,
    uri: Uri,
    id?: Maybe<string>
): string | null {
    let arr = record[uri]
    if (!arr) return null
    if (id !== undefined) arr = arr.filter((descriptor) => descriptor.id === id)
    return first(arr)?.value ?? null
}

export const descriptorValidator: ObjectSchema<Descriptor> = object({
    id: string().maybe().optional(),
    value: string().maybe().optional(),
})

export const descriptorRecordValidator: RecordSchema<DescriptorRecord> = record<
    Uri,
    readonly Descriptor[] | undefined
>(string(), array(descriptorValidator).readonly().orUndefined())
