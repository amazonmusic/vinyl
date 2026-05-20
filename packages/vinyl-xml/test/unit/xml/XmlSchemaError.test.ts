/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { XmlSchemaError } from '@amazon/vinyl-xml'
import { ErrorOrigin } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('XmlSchemaError', () => {
    it('is an instance of Error and XmlSchemaError', () => {
        expectPrototype(
            () => new XmlSchemaError('message'),
            XmlSchemaError,
            Error
        )
    })

    describe('name', () => {
        it('is XmlSchemaError', () => {
            expect(new XmlSchemaError('').name).toEqual('XmlSchemaError')
        })
    })

    describe('ErrorOrigin', () => {
        it('is PARSING', () => {
            expect(new XmlSchemaError('').origin).toEqual(ErrorOrigin.PARSING)
        })
    })
})
