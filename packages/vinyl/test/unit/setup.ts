/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getGlobalRegistry,
    getSearchParams,
    setGlobalRefDebug,
} from '@amazon/vinyl-util'
import {
    addCustomMatchers,
    ConsoleReporter,
    flushPromises,
} from '@amazon/vinyl-util/browserTestUtil'
import { RestApiReporter } from '@amazon/vinyl-util/testUtil'
import {
    initializeFrequencyAnalyzer,
    initializeMediaUnlock,
} from '@amazon/vinyl/vinylTestUtil'

addCustomMatchers()

// Diagnostic: GlobalRefImpl records the stack
setGlobalRefDebug(true)

// Configured here instead of the jasmine.config.json to work with both ts-node and the html
// test runner. `?stopOnSpecFailure=false` runs every spec, as test:integ does.
jasmine.getEnv().configure({
    stopOnSpecFailure: getSearchParams().get('stopOnSpecFailure') !== 'false',
    stopSpecOnExpectationFailure: true,
    failSpecWithNoExpectations: true,
})

// Register the reporters
jasmine.getEnv().addReporter(new ConsoleReporter())
RestApiReporter.installFromSearchParam()

// In a browser, prompts for a click to unlock media playback, then attaches the analyzer if checkAudio is set.
initializeMediaUnlock()
initializeFrequencyAnalyzer()

afterEach(async () => {
    await flushPromises()
    getGlobalRegistry().reset()
})
