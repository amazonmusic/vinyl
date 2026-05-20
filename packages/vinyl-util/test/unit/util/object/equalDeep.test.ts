/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { equalDeep } from '@amazon/vinyl-util'

describe('equalDeep', () => {
    describe('when strictly equal', () => {
        it('returns true', () => {
            expect(equalDeep(1, 2)).toBeFalse()
            expect(equalDeep(1, 1)).toBeTrue()
            expect(equalDeep(true, false)).toBeFalse()
            expect(equalDeep(true, true)).toBeTrue()
            expect(equalDeep(null, true)).toBeFalse()
            expect(equalDeep(void 0, null)).toBeFalse()
            expect(equalDeep(void 0, void 0)).toBeTrue()
            const a = {}
            expect(equalDeep(a, a)).toBeTrue()
            const b = {
                a: 3,
                b: 4,
                c: {},
            }
            expect(equalDeep(b, b, { rules: [] })).toBeTrue()
        })
    })

    describe('when not strictly equal', () => {
        describe('and no rules match', () => {
            it('returns false', () => {
                expect(equalDeep({}, {}, { rules: [] })).toBeFalse()
            })
        })

        describe('when comparing plain objects', () => {
            it('returns true if deeply equal', () => {
                expect(
                    equalDeep(
                        {
                            a: 3,
                            b: 'test',
                            c: true,
                            d: {
                                e: 1,
                                f: false,
                            },
                        },
                        {
                            a: 3,
                            b: 'test',
                            c: true,
                            d: {
                                e: 1,
                                f: false,
                            },
                        }
                    )
                ).toBeTrue()

                expect(
                    equalDeep(
                        {
                            a: 3,
                            b: 'test',
                            not_in_b: true,
                            d: {
                                e: 1,
                                f: false,
                            },
                        },
                        {
                            a: 3,
                            b: 'test',
                            not_in_a: true,
                            d: {
                                e: 1,
                                f: false,
                            },
                        }
                    )
                ).toBeFalse()
            })

            it('returns false if keys do not match', () => {
                expect(equalDeep({ a: 3 }, { a: 3, b: 4 })).toBeFalse()
                expect(equalDeep({ a: 3, b: 4 }, { a: 3 })).toBeFalse()

                expect(
                    equalDeep(
                        {
                            d: {
                                e: 1,
                                f: false,
                            },
                        },
                        {
                            d: {
                                e: 1,
                                f: false,
                                g: true,
                            },
                        }
                    )
                ).toBeFalse()

                expect(
                    equalDeep(
                        {
                            d: {
                                e: 1,
                                f: false,
                                g: {},
                            },
                        },
                        {
                            d: {
                                e: 1,
                                f: false,
                            },
                        }
                    )
                ).toBeFalse()
            })
        })

        describe('when comparing arrays', () => {
            it('returns true if array elements are equal', () => {
                expect(equalDeep([], [])).toBeTrue()
                expect(equalDeep([1, 2, 3], [1, 2, 3])).toBeTrue()
                expect(equalDeep([1, 2, 3], [1, 2, 3, 4])).toBeFalse()
                expect(equalDeep([1, 2, 3, 4], [1, 2, 3])).toBeFalse()

                expect(
                    equalDeep([1, 2, 3, { a: 1 }], [1, 2, 3, { a: 1 }])
                ).toBeTrue()
                expect(
                    equalDeep(
                        [1, 2, 3, { a: [1, 2, 3] }],
                        [1, 2, 3, { a: [1, 2, 3] }]
                    )
                ).toBeTrue()
                expect(
                    equalDeep(
                        [1, 2, 3, { a: [1, 2, 3] }],
                        [1, 2, 3, { a: [1, 2, 4] }]
                    )
                ).toBeFalse()
                expect(
                    equalDeep([1, 2, 3, [1, 2, 3]], [1, 2, 3, [1, 2, 3]])
                ).toBeTrue()
                expect(
                    equalDeep([1, 2, 3, [1, 2, 3]], [1, 2, 3, [1, 2, 3, []]])
                ).toBeFalse()
                expect(
                    equalDeep(
                        [1, 2, 3, [1, 2, 3, []]],
                        [1, 2, 3, [1, 2, 3, []]]
                    )
                ).toBeTrue()
                expect(
                    equalDeep(
                        [1, 2, 3, [1, 2, 3, [null]]],
                        [1, 2, 3, [1, 2, 3, []]]
                    )
                ).toBeFalse()
            })
        })

        describe('when comparing RegExp', () => {
            it('compares based on source, flags, and lastIndex', () => {
                expect(equalDeep(/test/gi, /test/gi)).toBeTrue()
                expect(equalDeep(/test/gi, /test2/gi)).toBeFalse()
                expect(equalDeep(/test/gi, /test/g)).toBeFalse()
                const a = /test/gi
                a.lastIndex = 3
                expect(equalDeep(/test/gi, a)).toBeFalse()
            })
        })

        describe('when comparing Date', () => {
            it('compares based on time', () => {
                expect(equalDeep(new Date(1), new Date(1))).toBeTrue()
                expect(equalDeep(new Date(1), new Date(2))).toBeFalse()
                expect(
                    equalDeep({ a: new Date(1) }, { a: new Date(1) })
                ).toBeTrue()
                expect(
                    equalDeep({ a: new Date(1) }, { a: new Date(2) })
                ).toBeFalse()
                expect(equalDeep([new Date(1)], [new Date(2)])).toBeFalse()
                expect(equalDeep([new Date(1)], [new Date(1)])).toBeTrue()
            })
        })

        describe('when comparing sets', () => {
            it('compares all keys', () => {
                expect(equalDeep(new Set([]), new Set([]))).toBeTrue()
                expect(equalDeep(new Set([]), new Set([1]))).toBeFalse()
                expect(equalDeep(new Set([2]), new Set([1]))).toBeFalse()
                expect(
                    equalDeep(new Set([1, 2, 3]), new Set([3, 2, 1]))
                ).toBeTrue()
                expect(
                    equalDeep(new Set([1, 2, 3]), new Set([3, 4, 5]))
                ).toBeFalse()
            })
        })

        describe('when comparing TypedArray', () => {
            it('compares all elements', () => {
                expect(
                    equalDeep(new Uint8Array([]), new Uint8Array([]))
                ).toBeTrue()
                expect(
                    equalDeep(
                        new Uint8Array([1, 2, 3]),
                        new Uint8Array([1, 2, 3])
                    )
                ).toBeTrue()
                expect(
                    equalDeep(
                        new Uint8Array([1, 3, 2]),
                        new Uint8Array([1, 2, 3])
                    )
                ).toBeFalse()
                expect(
                    equalDeep<any>(
                        new Uint16Array([1, 3, 2]),
                        new Uint8Array([1, 3, 2])
                    )
                ).toBeFalse()
                expect(
                    equalDeep<any>(
                        new Uint8Array([1, 3]),
                        new Uint8Array([1, 3, 2])
                    )
                ).toBeFalse()
                expect(
                    equalDeep<any>(
                        new Uint16Array([1, 3, 2, 5, 6]),
                        new Uint16Array([1, 3, 2, 5, 6])
                    )
                ).toBeTrue()
            })
        })

        describe('when comparing Map', () => {
            it('compares all elements', () => {
                expect(equalDeep(new Map([]), new Map([]))).toBeTrue()
                expect(
                    equalDeep(new Map([[1, 2]]), new Map([[1, 2]]))
                ).toBeTrue()
                expect(
                    equalDeep(
                        new Map([[1, 2]]),
                        new Map([
                            [1, 2],
                            [2, 3],
                        ])
                    )
                ).toBeFalse()
                expect(
                    equalDeep(
                        new Map([['a', new Map()]]),
                        new Map([['a', new Map()]])
                    )
                ).toBeTrue()
                expect(
                    equalDeep(new Map([['a', 1]]), new Map([['b', 1]]))
                ).toBeFalse()
                expect(
                    equalDeep(
                        new Map([
                            [
                                'a',
                                new Map([
                                    ['a1', 1],
                                    ['a2', 2],
                                    ['a3', 3],
                                ]),
                            ],
                        ]),
                        new Map([
                            [
                                'a',
                                new Map([
                                    ['a1', 1],
                                    ['a2', 2],
                                    ['a3', 3],
                                ]),
                            ],
                        ])
                    )
                ).toBeTrue()
                expect(
                    equalDeep(
                        new Map([
                            [
                                'a',
                                new Map([
                                    ['a1', 1],
                                    ['a2', 2],
                                    ['a3', 3],
                                ]),
                            ],
                        ]),
                        new Map([
                            [
                                'a',
                                new Map([
                                    ['a1', 1],
                                    ['a2', 2],
                                    ['a3', 3],
                                    ['a4', 4],
                                ]),
                            ],
                        ])
                    )
                ).toBeFalse()
                expect(
                    equalDeep(
                        new Map([
                            [
                                'a',
                                new Map([
                                    ['a1', 1],
                                    ['a2', 2],
                                    ['a3', 3],
                                ]),
                            ],
                        ]),
                        new Map([
                            [
                                'a',
                                new Map([
                                    ['a1', 1],
                                    ['a2', 2],
                                    ['a3', 4],
                                ]),
                            ],
                        ])
                    )
                ).toBeFalse()
            })
        })

        describe('and objects match different rules', () => {
            it('returns false', () => {
                expect(equalDeep({}, [])).toBeFalse()
            })
        })
    })
})
