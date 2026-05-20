/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Creates a marble test, returning a function (input: string) => string where the input is a
 * sequence of characters, each character mapping to the legend, and the output a string
 * produced by the output generator.
 *
 * @param init
 * @param legend An object whose keys are characters, and the values are functions to invoke when
 * the character is found in the input string.
 * @param output A method to invoke at the end of the actions to return the output sequence.
 */
export function marbleTest<T>(
    init: () => Promise<T> | T,
    legend: Readonly<
        Record<string, ((test: T) => Promise<void> | void) | undefined>
    >,
    output: (test: T) => Promise<string> | string
): (input: string) => Promise<string> {
    return async (input: string): Promise<string> => {
        const test = await init()
        for (let i = 0; i < input.length; i++) {
            const char = input[i]
            const action = legend[char]
            if (!action) throw new Error(`Unknown marble: '${char}'`)
            await action(test)
        }
        return output(test)
    }
}
