/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//----------------------------------------------------------------------------
// Tests to validate that Types are what we expect them to be.
// These tests are for the compiler only and have no runtime significance.
//
// expect(true).toBeTrue() is to avoid jasmine no-expectation warnings for
// tests that only have compile-time assertions.
//----------------------------------------------------------------------------

/**
 * A type that equals true if Left and Right are strictly equal.
 * Works with complex objects, readonly, and optional modifiers.
 * Works with method input arguments.
 * This will always equal true or false, and never the union `true | false`
 */
export type StrictEqual<Left, Right> =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    (<T>() => T extends Left ? 0 : 1) extends <T>() => T extends Right ? 0 : 1
        ? Equal<Left, Right>
        : false

/**
 * A type that equals true if Left and Right are loosely equal, that is, that Left extends Right
 * and Right extends Left.
 * This will always equal true or false, and never the union `true | false`
 */
export type Equal<Left, Right> = [Left] extends [Right]
    ? [Right] extends [Left]
        ? true
        : false
    : false

/**
 * Adds a compile-time check that types Left and Right are identical.
 */
export function expectTypeStrictlyEquals<Left, Right>(
    _matches: StrictEqual<Left, Right>
): void {
    expect(true).toBeTrue()
}

// noinspection JSUnusedLocalSymbols
/**
 * Adds a compile-time check that type Left extends Right and Right extends Left.
 * This is not as strict as `expectTypeStrictlyEquals`, it does not validate:
 * - unknown types
 * - any types
 */
export function expectTypeEquals<Left, Right>(
    _matches: Equal<Left, Right>
): void {
    expect(true).toBeTrue()
}

// noinspection JSUnusedLocalSymbols
/**
 * Adds a compile-time check that Sub extends Super.
 * This is distributive, so `expectTypeExtends<1, 1 | 2>` will expect true.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function expectTypeExtends<Sub, Super>(
    _matches: [Sub] extends [Super] ? true : false
): void {
    expect(true).toBeTrue()
}

/**
 * Adds a compile-time check that expects that the given type is exactly true.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters,@typescript-eslint/no-unused-vars
export function expectTypeTrue<T extends true>(): void {
    expect(true).toBeTrue()
}

/**
 * Adds a compile-time check that expects that the given type is exactly false.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters,@typescript-eslint/no-unused-vars
export function expectTypeFalse<T extends false>(): void {
    expect(true).toBeTrue()
}
