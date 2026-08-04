/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createAllowedContentTypesValue,
    type ContentType,
    type RestrictableContentType,
} from '@amazon/vinyl'
import { data } from '@amazon/vinyl-observable'
import type { ReadonlySet } from '@amazon/vinyl-util'

describe('createAllowedContentTypesValue', () => {
    let baseContentTypesValue: ReturnType<
        typeof data<Promise<ReadonlySet<ContentType>>>
    >
    let options: ReturnType<
        typeof data<{
            allowedContentTypes: readonly RestrictableContentType[] | null
        }>
    >

    beforeEach(() => {
        baseContentTypesValue = data<Promise<ReadonlySet<ContentType>>>(
            Promise.resolve(new Set<ContentType>(['audio', 'video', 'text']))
        )
        options = data<{
            allowedContentTypes: readonly RestrictableContentType[] | null
        }>({ allowedContentTypes: null })
    })

    it('passes all content types through when the allow list is null', async () => {
        const result = await createAllowedContentTypesValue({
            baseContentTypesValue,
            options,
        }).value
        expect(result).toEqual(new Set(['audio', 'video', 'text']))
    })

    it('keeps only the allowed media content types', async () => {
        options.value = { allowedContentTypes: ['audio'] }
        const result = await createAllowedContentTypesValue({
            baseContentTypesValue,
            options,
        }).value
        // Text always passes through; video is dropped.
        expect(result).toEqual(new Set(['audio', 'text']))
    })

    it('always keeps text even when only video is allowed', async () => {
        options.value = { allowedContentTypes: ['video'] }
        const result = await createAllowedContentTypesValue({
            baseContentTypesValue,
            options,
        }).value
        expect(result).toEqual(new Set(['video', 'text']))
    })

    it('keeps text even when the allow list is empty', async () => {
        options.value = { allowedContentTypes: [] }
        const result = await createAllowedContentTypesValue({
            baseContentTypesValue,
            options,
        }).value
        expect(result).toEqual(new Set(['text']))
    })

    it('ignores allowed types not present in the manifest', async () => {
        baseContentTypesValue.value = Promise.resolve(
            new Set<ContentType>(['audio'])
        )
        options.value = { allowedContentTypes: ['audio', 'video'] }
        const result = await createAllowedContentTypesValue({
            baseContentTypesValue,
            options,
        }).value
        expect(result).toEqual(new Set(['audio']))
    })

    it('re-emits a newly filtered set when the allow list changes', async () => {
        const value = createAllowedContentTypesValue({
            baseContentTypesValue,
            options,
        })

        const emissions: ReadonlySet<ContentType>[] = []
        const unsub = value.onData((promise) => {
            void promise.then((set) => emissions.push(set))
        })

        // Changing the allow list should produce a new, filtered emission,
        // which is what drives the track to reload with only these types.
        options.value = { allowedContentTypes: ['audio'] }
        expect(await value.value).toEqual(new Set(['audio', 'text']))

        unsub()
        // Wait for all pending promise callbacks to resolve.
        await Promise.resolve()
        await Promise.resolve()
        expect(emissions).toEqual([
            new Set(['audio', 'video', 'text']),
            new Set(['audio', 'text']),
        ])
    })
})
