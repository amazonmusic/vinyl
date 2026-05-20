/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PatchedRef } from '@amazon/vinyl-util'
import { expectNothing } from '@amazon/vinyl-util/browserTestUtil'

export interface PatchTestOptions<T> {
    /**
     * True if the patch is enabled by default.
     */
    actualFlag: boolean | undefined

    /**
     * The target, not patched.
     */
    target: T

    /**
     * The patched target.
     */
    patchedRef: PatchedRef<T>

    /**
     * Runs the scenario to reproduce the issue on the target.
     * @param target
     */
    canReproduce: (target: T) => Promise<boolean>

    /**
     * If true and the tested flag is true but the issue cannot be reproduced, then only a
     * warning is logged, if false, then the test will be marked as a failure.
     */
    allowFalseNegative: boolean
}

/**
 * Adds tests to ensure that a patch flag is enabled when the issue can be reproduced for the UA,
 * and when the patch is applied the issue is no longer reproducible.
 *
 * @param flagName The flag name, used in test descriptions.
 * @param description The condition which requires the patch to be enabled.
 * @param optionsProvider
 */
export function addPatchTests<T>(
    flagName: string,
    description: string,
    optionsProvider: () => PatchTestOptions<T>
) {
    let options: PatchTestOptions<T>

    beforeEach(() => {
        options = optionsProvider()
    })

    afterEach(() => {
        // null safety check required, if test is skipped, beforeEach is not called but
        // afterEach is.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        options?.patchedRef.dispose()
    })

    it('sets the default flag to true only if the issue can be reproduced', async () => {
        const canReproduce = await options.canReproduce(options.target)
        if (canReproduce) {
            if (!options.actualFlag)
                fail(`expected patch flag '${flagName}' to be true`)
        } else {
            if (options.actualFlag) {
                // The flag was true but the issue could not be reproduced.
                // Most issues being patched cannot be reproduced with 100% reliability.
                // Allow reproduction misses to be merely a warning instead of failing the test.
                const message = `flag '${flagName}' was true but issue not reproduced`
                if (options.allowFalseNegative) console.warn(message)
                else fail(message)
            }
        }
        expectNothing()
    })

    describe(`when the ${flagName} is true`, () => {
        it(description, async () => {
            if (options.actualFlag) {
                if (await options.canReproduce(options.patchedRef.patched))
                    fail('patch did not resolve issue')
            }
            expectNothing()
        })
    })
}
