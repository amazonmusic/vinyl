/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import CustomReporter = jasmine.CustomReporter
import JasmineStartedInfo = jasmine.JasmineStartedInfo
import SpecResult = jasmine.SpecResult
import FailedExpectation = jasmine.FailedExpectation

export class ConsoleReporter implements CustomReporter {
    private errors: FailedExpectation[] = []

    jasmineStarted(suiteInfo: JasmineStartedInfo): void {
        console.log(
            `Running suite with ${suiteInfo.totalSpecsDefined} specs, seed ${suiteInfo.order.seed}`
        )
        console.log(
            'Testing for UA:',
            typeof navigator === 'object' ? navigator.userAgent : 'Node.js/<21'
        )
    }

    specDone(result: SpecResult): void {
        if (result.failedExpectations.length > 0) {
            console.warn(`Spec failed: ${result.fullName}`)
            for (let i = 0; i < result.failedExpectations.length; i++) {
                console.warn(`Failure: ${result.failedExpectations[i].message}`)
                console.warn(result.failedExpectations[i].stack)
                this.errors.push(result.failedExpectations[i])
            }
        }
    }

    jasmineDone(): void {
        if (this.errors.length > 0) {
            console.log(`There were ${this.errors.length} errors:`)
            this.errors.forEach((error, index) => {
                console.error(`Error ${index + 1}:`, error)
            })
        } else {
            console.log('No errors were found.')
        }
    }
}
