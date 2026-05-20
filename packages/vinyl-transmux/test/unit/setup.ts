/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    addCustomMatchers,
    ConsoleReporter,
    flushPromises,
} from '@amazon/vinyl-util/browserTestUtil'
import { RestApiReporter } from '@amazon/vinyl-util/testUtil'
import { getGlobalRegistry } from '@amazon/vinyl-util'

addCustomMatchers()

jasmine.getEnv().configure({
    stopOnSpecFailure: true,
    stopSpecOnExpectationFailure: true,
    failSpecWithNoExpectations: true,
})

jasmine.getEnv().addReporter(new ConsoleReporter())
RestApiReporter.installFromSearchParam()

afterEach(async () => {
    await flushPromises()
    getGlobalRegistry().reset()
})
