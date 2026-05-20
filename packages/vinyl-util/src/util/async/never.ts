/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

class Never implements Promise<never> {
    catch<TResult = never>(
        _onrejected?: ((reason: any) => PromiseLike<TResult> | TResult) | null
    ): Promise<never> {
        return this
    }

    then<TResult1 = never, TResult2 = never>(
        _onfulfilled?:
            | ((value: never) => PromiseLike<TResult1> | TResult1)
            | null,
        _onrejected?: ((reason: any) => PromiseLike<TResult2> | TResult2) | null
    ): Promise<never> {
        return this
    }

    finally(_onfinally?: (() => void) | null): Promise<never> {
        return this
    }

    get [Symbol.toStringTag](): 'Never' {
        return 'Never'
    }
}

/**
 * A promise that never settles.
 */
export const never: Promise<never> = new Never()
