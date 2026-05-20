/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    CloneCallback,
    CloneOptions,
    CloneRule,
    MutableDeep,
} from '@amazon/vinyl-util'
import { clone, toMergeRule } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('clone', () => {
    it('aliases mergeDeep', () => {
        expect(clone([1, 2, 3])).toEqual([1, 2, 3])
    })

    it('accepts clone and merge rules', () => {
        const fooCloneRule: CloneRule<Foo> = {
            clone(source: Foo, clone: CloneCallback): Foo {
                return new Foo(source.bar, clone(source.foo, 'foo'))
            },
            matches(object: any): object is Foo {
                return object instanceof Foo
            },
        }
        const options: Partial<CloneOptions> = {
            rules: [fooCloneRule],
        }
        const source = new Foo(3, new Foo(4, null))
        const cloned = clone(source, options)
        expect(cloned).toEqual(source)
        expect(cloned).not.toBe(source)
    })

    it('allows copying function references', () => {
        const fun = () => {}
        expect(clone([1, fun, { a: 2, b: fun }])).toEqual([
            1,
            fun,
            { a: 2, b: fun },
        ])
    })

    it('does not allow reference copying by default', () => {
        class Foo {
            get [Symbol.toStringTag]() {
                return 'Foo'
            }
        }
        const foo = new Foo()
        expect((): void => {
            clone(foo)
        }).toThrowError(
            'No merge rule found at 0 for "[object Foo]" and reference copy not allowed'
        )
        expect(clone(foo, { allowReferenceCopy: true })).toBe(foo)
    })
})

describe('toMergeRule', () => {
    it('converts a merge rule to a clone rule', () => {
        const fooMergeRule: CloneRule<Foo> = {
            matches(object: any): object is Foo {
                return object instanceof Foo
            },
            clone(source: Foo, clone: CloneCallback): MutableDeep<Foo> {
                return new Foo(source.bar, clone(source.foo, 'foo'))
            },
        }
        const mergeRule = toMergeRule(fooMergeRule)
        const foo = new Foo(1, new Foo(2, null))
        expect(mergeRule.matches(foo)).toBeTrue()
        const spy = createSpy('mergeCallback')
        const actual = mergeRule.merge(undefined, foo, spy)
        expect(actual.bar).toEqual(foo.bar)
        expect(actual).not.toBe(foo)
        expect(spy).toHaveBeenCalledOnceWith(undefined, foo.foo, 'foo')
    })
})

class Foo {
    constructor(
        readonly bar: number,
        readonly foo: Foo | null
    ) {}

    toString(): string {
        return `Foo(bar=${this.bar}, foo=${this.foo})`
    }
}
