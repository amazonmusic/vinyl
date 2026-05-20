/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type { KeyValuePersistence } from '@amazon/vinyl-util'

export class MockPersistence<T = any> implements KeyValuePersistence<T> {
    private readonly spyFactory = createSpyFactory<KeyValuePersistence<T>>()

    clear = this.spyFactory('clear')

    get = this.spyFactory('get')

    remove = this.spyFactory('remove')

    set = this.spyFactory('set')
}
