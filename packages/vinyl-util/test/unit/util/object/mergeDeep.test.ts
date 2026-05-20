/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Cloneable, MergeCallback, MergeRule } from '@amazon/vinyl-util'
import {
    IllegalArgumentError,
    mergeDeep,
    MergeReferenceError,
    ReportableError,
} from '@amazon/vinyl-util'
import {
    expectIterableEquals,
    expectPrototype,
} from '@amazon/vinyl-util/browserTestUtil'

describe('mergeDeep', () => {
    describe('when passed zero sources', () => {
        it('returns undefined', () => {
            expect(mergeDeep([])).toBeUndefined()
        })
    })

    describe('when passed one source', () => {
        it('deeply clones the value', () => {
            const a = {
                b: {
                    c: 1,
                    d: [2, 5],
                    e: {
                        f: 'test',
                    },
                },
            }
            const clone = mergeDeep([a])
            expect(clone).toEqual(a)
            expect(clone).not.toBe(a)
            expect(clone.b).not.toBe(a.b)
        })

        describe('when there are cyclic references', () => {
            it('throws an IllegalArgumentError', () => {
                const withCyclicRef = {
                    get b() {
                        return withCyclicRef
                    },
                }
                expect(() => mergeDeep([withCyclicRef])).toThrowMatching(
                    (e) => {
                        expect(e).toBeInstanceOf(IllegalArgumentError)
                        expect(e.message).toEqual(
                            'Cyclic reference found at: 0.b'
                        )
                        return true
                    }
                )

                const symbol = Symbol()
                expect(mergeDeep([symbol, symbol])).toEqual(symbol)
                const withoutCyclicRef = {
                    s1: symbol,
                    s2: symbol,
                    s: symbol,
                    b: {
                        s1: symbol,
                        s2: symbol,
                        s: symbol,
                    },
                }
                expect(mergeDeep([withoutCyclicRef, withoutCyclicRef])).toEqual(
                    withoutCyclicRef
                )
            })
        })

        describe('when there are objects that do not pass any merge rules', () => {
            it('copies by reference', () => {
                class Foo {
                    readonly bar = 3
                }

                const source = { foo: new Foo() }
                const clone = mergeDeep([source])
                expect(clone.foo).toBe(source.foo)
            })
        })

        describe('when an object implements cloneable', () => {
            it('uses the cloneable rule', () => {
                class CloneableImpl implements Cloneable<CloneableImpl> {
                    constructor(readonly id = 0) {}
                    clone(): CloneableImpl {
                        return new CloneableImpl(this.id + 1)
                    }
                }
                const a = {
                    b: new CloneableImpl(),
                }
                const clone = mergeDeep([a])
                expect(clone.b.id).toBe(1)
            })
        })
    })

    describe('when passed two sources', () => {
        describe('and both are objects', () => {
            it('merges the objects', () => {
                const a = {
                    b: {
                        c: 1,
                        d: [6, 7],
                        e: {
                            f: 'foo',
                            g: 'bar',
                        },
                    },
                }
                const b = {
                    a: 0,
                    b: {
                        d: [8],
                        e: {
                            g: 'baz',
                            h: 9,
                        },
                    },
                }
                const result = mergeDeep([a, b])
                expect(result).toEqual({
                    a: 0,
                    b: {
                        c: 1,
                        d: [6, 7, 8],
                        e: {
                            f: 'foo',
                            g: 'baz',
                            h: 9,
                        },
                    },
                })
            })

            describe('when there are cyclic references', () => {
                it('throws an IllegalArgumentError', () => {
                    const a = {
                        b: 1,
                    }
                    const b = {
                        b: 2,
                        c: {
                            get a() {
                                return b
                            },
                        },
                    }
                    expect(() => mergeDeep([a, b])).toThrowMatching((e) => {
                        expect(e).toBeInstanceOf(IllegalArgumentError)
                        expect(e.message).toEqual(
                            'Cyclic reference found at: 1.c.a'
                        )
                        return true
                    })
                })
            })
        })

        describe('and both are arrays', () => {
            it('concatenates the cloned elements', () => {
                const a = [1, 2, { a: 3 }] as const
                const b = [4, 5, { b: 6 }] as const
                const merged = mergeDeep([a, b])
                expect(merged).toEqual([1, 2, { a: 3 }, 4, 5, { b: 6 }])
                expect(merged[5]).not.toBe(b[2])
            })
        })

        describe('and second source is an array', () => {
            it('clones the array', () => {
                const source = [1, 2, { a: 3, b: { foo: 'bar' } }] as const
                const merged = mergeDeep([{}, source])
                expect(merged).toEqual([1, 2, { a: 3, b: { foo: 'bar' } }])
                expect(merged).not.toBe(source)
                expect(merged[2]).not.toBe(source[2])
                expect(merged[2].b).not.toBe(source[2].b)
            })
        })

        describe('and second source is an array', () => {
            it('clones the second source', () => {
                const source = [4, 5, { b: 6 }] as const
                const merged = mergeDeep<any, any>(['test', source])
                expect(merged).toEqual([4, 5, { b: 6 }])
                expect(merged[2]).not.toBe(source[2])
            })
        })

        describe('and both are maps', () => {
            it('collates the cloned elements', () => {
                const a = new Map<any, any>([
                    ['a', 1],
                    ['b', 2],
                    ['c', { foo: 3 }],
                ])
                const b = new Map<any, any>([
                    ['a', 4],
                    ['d', { bar: 5 }],
                ])
                const merged = mergeDeep([a, b])
                expect(merged).toEqual(
                    new Map<any, any>([
                        ['a', 4],
                        ['b', 2],
                        ['c', { foo: 3 }],
                        ['d', { bar: 5 }],
                    ])
                )
                expect(merged.get('c')).not.toBe(a.get('c'))
                expect(merged.get('d')).not.toBe(b.get('d'))
            })
        })

        describe('and second source is a map', () => {
            it('clones all entries', () => {
                const a = new Map<any, any>([
                    ['a', 1],
                    ['b', 2],
                    ['c', { foo: 3 }],
                ])
                const merged = mergeDeep<any, any>(['test', a])
                expect(merged).toEqual(
                    new Map<any, any>([
                        ['a', 1],
                        ['b', 2],
                        ['c', { foo: 3 }],
                    ])
                )
                expect(merged.get('c')).not.toBe(a.get('c'))
            })
        })

        describe('and both are sets', () => {
            it('concatenates the cloned elements', () => {
                const a = new Set<any>([1, 2, { a: 3 }])
                const b = new Set<any>([1, 2, 4, 5, { b: 6 }])
                const merged = mergeDeep([a, b])
                expect(merged).toEqual(
                    new Set([1, 2, { a: 3 }, 4, 5, { b: 6 }])
                )
                expect([...merged.values()][5]).not.toBe([...b.values()][4])
            })
        })

        describe('and second source is a set', () => {
            it('returns a cloned set', () => {
                const source = new Set<any>([1, 2, 3, { b: 6 }])
                const merged = mergeDeep<any, any>(['test', source])
                expect(merged).toEqual(source)
                expect(merged).not.toBe(source)
                expect([...merged.values()][3]).not.toBe(
                    [...source.values()][3]
                )
            })
        })

        describe('and second source is a typed array', () => {
            it('returns a cloned typed array', () => {
                const source = new Uint8Array([1, 2, 3])
                const merged = mergeDeep<any, any>(['test', source])
                expectIterableEquals(merged, source)
                expect(merged).not.toBe(source)
                expect(merged.buffer).not.toBe(source.buffer)
            })
        })

        describe('and both are dates', () => {
            it('returns the second date cloned', () => {
                const first = new Date(123)
                const second = new Date(456)
                const merged = mergeDeep<any, any>([first, second])
                expect(merged).not.toBe(second)
                expect(merged).toEqual(second)
            })
        })

        describe('and second source is a date', () => {
            it('returns a cloned date', () => {
                const date = new Date(123)
                const merged = mergeDeep<any, any>(['test', date])
                expect(merged).not.toBe(date)
                expect(merged).toEqual(date)
            })
        })

        describe('and second source is a URL', () => {
            it('returns a cloned URL', () => {
                const first = new URL('https://www.example.com/')
                const second = new URL('https://www.amazon.com/')
                const merged = mergeDeep<any, any>([first, second])
                expect(merged).not.toBe(second)
                expect(merged).toEqual(second)
            })
        })

        describe('and types are incompatible', () => {
            it('returns a clone of the latter source', () => {
                expect(mergeDeep([undefined, 1])).toEqual(1)
                expect(mergeDeep<any, any>([[1], 1])).toEqual(1)
                expect(mergeDeep([{}, /abc/])).toEqual(/abc/)
                expect(mergeDeep<any, any>([/abc/, { a: 1 }])).toEqual({ a: 1 })
            })
        })
    })

    describe('when passed 3 sources', () => {
        describe('and all types are compatible', () => {
            it('merges all sources', () => {
                expect(
                    mergeDeep([
                        [0, 1],
                        [2, { a: 3 }],
                        [4, 5],
                    ])
                ).toEqual([0, 1, 2, { a: 3 }, 4, 5])

                expect(
                    mergeDeep([
                        {
                            a: 1,
                            b: undefined,
                            c: 3,
                            d: 4,
                        },
                        {
                            b: 5,
                            c: undefined,
                        },
                        {
                            d: 6,
                            e: 7,
                        },
                    ])
                ).toEqual({
                    a: 1,
                    b: 5,
                    c: undefined,
                    d: 6,
                    e: 7,
                })
            })
        })

        describe('and all types are not compatible', () => {
            it('merges the last sources that are compatible', () => {
                expect(mergeDeep([1, [2, 3], [4, 5]])).toEqual([2, 3, 4, 5])
                expect(
                    mergeDeep([
                        null,
                        {
                            a: 1,
                            b: {
                                c: [1, 2, 3],
                                d: 'foo',
                            },
                        },
                        {
                            b: {
                                c: [4, 5],
                                d: 'bar',
                            },
                        },
                    ])
                ).toEqual({
                    a: 1,
                    b: {
                        c: [1, 2, 3, 4, 5],
                        d: 'bar',
                    },
                })
            })
        })
    })

    describe('when options.allowReferenceCopy is false', () => {
        it('throws a MergeReferenceError when no rules match', () => {
            class Foo {
                get [Symbol.toStringTag](): string {
                    return 'Foo'
                }
            }

            expect(() => {
                mergeDeep([new Foo()], { allowReferenceCopy: false })
            }).toThrowError(
                'No merge rule found at 0 for "[object Foo]" and reference copy not allowed'
            )
            expect(() => {
                mergeDeep([undefined, new Foo()], { allowReferenceCopy: false })
            }).toThrowError(
                'No merge rule found at 1 for "[object Foo]" and reference copy not allowed'
            )
            expect(() => {
                mergeDeep([undefined, { foo: new Foo() }], {
                    allowReferenceCopy: false,
                })
            }).toThrowError(
                'No merge rule found at 1.foo for "[object Foo]" and reference copy not allowed'
            )
        })

        it('copies primitives', () => {
            expect(mergeDeep([1], { allowReferenceCopy: false })).toBe(1)
            expect(mergeDeep([null, 1], { allowReferenceCopy: false })).toBe(1)
        })
    })

    describe('when options.rules are provided', () => {
        it('uses given rules instead of defaults', () => {
            class Foo {
                constructor(
                    readonly bar?: number,
                    readonly baz?: string
                ) {}
            }

            const fooMergeRule: MergeRule<Foo> = {
                matches(object: any): object is Foo {
                    return object instanceof Foo
                },
                merge(
                    sourceA: Foo | undefined,
                    sourceB: Foo,
                    _: MergeCallback
                ): Foo {
                    return new Foo(
                        sourceA?.bar ?? sourceB.bar,
                        sourceA?.baz ?? sourceB.baz
                    )
                },
            }

            expect(
                mergeDeep([new Foo(1), new Foo(undefined, 'a')], {
                    allowReferenceCopy: false,
                    rules: [fooMergeRule],
                })
            ).toEqual(new Foo(1, 'a'))
        })
    })
})

describe('MergeReferenceError', () => {
    it('is an instance of Error and MergeReferenceError', () => {
        expectPrototype(
            () => new MergeReferenceError('message', 'Type'),
            MergeReferenceError,
            ReportableError,
            Error
        )
    })
})
