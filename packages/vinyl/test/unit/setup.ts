/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGlobalRegistry, setGlobalRefDebug } from '@amazon/vinyl-util'
import {
    addCustomMatchers,
    ConsoleReporter,
    flushPromises,
} from '@amazon/vinyl-util/browserTestUtil'
import { RestApiReporter } from '@amazon/vinyl-util/testUtil'
import { initializeFrequencyAnalyzer } from '@amazon/vinyl/vinylTestUtil'

addCustomMatchers()

// Diagnostic: GlobalRefImpl records the stack
setGlobalRefDebug(true)

// Configured here instead of the jasmine.config.json to work with both ts-node and the html
// test runner.
jasmine.getEnv().configure({
    stopOnSpecFailure: true,
    stopSpecOnExpectationFailure: true,
    failSpecWithNoExpectations: true,
})

// Register the reporters
jasmine.getEnv().addReporter(new ConsoleReporter())
RestApiReporter.installFromSearchParam()

// Prompts for user interaction and unlocks the AudioContext if checkAudio is present in the query params.
initializeFrequencyAnalyzer()

afterEach(async () => {
    await flushPromises()
    getGlobalRegistry().reset()
})
