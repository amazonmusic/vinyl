/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { externalData, type ObservableValue } from './observableValue'
import type { ReadonlyRecord, Unsubscribe } from '@amazon/vinyl-util'

/**
 * Combines a record of data providers into a single provider of a record of values.
 *
 * @param inputs A record of data providers.
 */
export function combineData<
    const T extends ReadonlyRecord<string, ObservableValue<unknown>>,
>(
    inputs: T
): ObservableValue<{
    readonly [K in keyof T]: T[K] extends ObservableValue<infer U> ? U : T[K]
}> {
    type Output = {
        [K in keyof T]: T[K] extends ObservableValue<infer U> ? U : T[K]
    }

    const keys = Object.keys(inputs) as (keyof T)[]
    const providers: Record<keyof T, ObservableValue<any>> = {} as any
    const current: Partial<Output> = {}

    // Normalize all inputs to DataProviders and initialize current value
    for (const key of keys) {
        const provider = inputs[key]
        providers[key] = provider
        current[key] = provider.value as any
    }

    return externalData(current as Output, (setData) => {
        const subs: Unsubscribe[] = []
        // `onData` emits immediately, and an input may have changed since this
        // record was first built, so those emissions are recorded rather than
        // skipped. Publishing is held off until every input is subscribed so a
        // partially updated record is never emitted.
        let subscribing = true

        for (const key of keys) {
            subs.push(
                providers[key].onData((value) => {
                    current[key] = value
                    if (!subscribing) setData({ ...current } as Output)
                })
            )
        }
        subscribing = false
        setData({ ...current } as Output)

        return () => {
            for (const unsub of subs) unsub()
        }
    })
}
