/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export type WritableKeys<T> = {
    [K in keyof T]-?: IfEquals<
        { [P in K]: T[K] },
        { -readonly [P in K]: T[K] },
        K
    >
}[keyof T]

export type Writable<T> = Pick<T, WritableKeys<T>>

export type IfEquals<X, Y, A = X, B = never> =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B
