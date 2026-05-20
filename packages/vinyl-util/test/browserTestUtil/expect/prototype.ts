/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Expect that the given factory produces an instance of `clazz` and `superClass`
 * This is different from `expect(e).toBeInstanceOf` in that it accounts for TypeScript's branching
 * if _super.call returns undefined.
 *
 * For example, IllegalArgumentError extends Error will produce the following constructor:
 * ```
 * var _this = _super.call(this, message) || this;
 * Object.setPrototypeOf(_this, IllegalArgumentError.prototype);
 * ```
 * The branch of _super.call || this requires two tests for perfect coverage, one for the falsy
 * case, and one for the truthy case.
 *
 * @param factory
 * @param classes
 */
export function expectPrototype(factory: () => any, ...classes: any[]): void {
    const e = factory()
    classes.forEach((clazz) => expect(e).toBeInstanceOf(clazz))
    const spy = spyOn(classes[classes.length - 1], 'call')
    spy.and.returnValue(null)
    const e2 = factory()
    classes.forEach((clazz) => expect(e2).toBeInstanceOf(clazz))
}
