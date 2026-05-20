/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data, type MutableValue } from '@amazon/vinyl-observable'
import type { AddDisposable, AnyRecord } from '@amazon/vinyl-util'
import type { Validator } from '@amazon/vinyl-validation'

export function playerConfigFactory<T>(
    defaults: T,
    validator: Validator<T>
): (_deps: AnyRecord, add: AddDisposable) => MutableValue<T> {
    return (_deps, add) => {
        const config = data<T>(defaults)
        add(
            config.onData((data) => {
                // Throws if data does not pass validation
                validator.assert(data)
            })
        )
        return config
    }
}
