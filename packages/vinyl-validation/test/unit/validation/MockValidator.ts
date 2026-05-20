/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Validator } from '@amazon/vinyl-validation'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

export class MockValidator<Output extends Input = any, Input = any>
    implements Validator<Output, Input>
{
    private readonly spyFactory = createSpyFactory<Validator<Output, Input>>()

    description = ''
    assert = this.spyFactory('assert')
    isValid = this.spyFactory('isValid')
    validate = this.spyFactory('validate')
}
