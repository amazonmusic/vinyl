/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import { CyclicDependencyError } from '@amazon/vinyl-di'
import { ReportableError } from '@amazon/vinyl-util'

describe('CyclicDependencyError', () => {
    it('is an instance of Error and CyclicDependencyError', () => {
        expectPrototype(
            () => new CyclicDependencyError('message'),
            CyclicDependencyError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new CyclicDependencyError('')[Symbol.toStringTag]).toBe(
                'CyclicDependencyError'
            )
        })
    })
})
