/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    TokenizedInfo,
    tokenizeUserAgent,
    tokenQuery,
} from '@amazon/vinyl-util'

describe('user agent tokenization', () => {
    describe('tokenizeUserAgent', () => {
        it('returns tokenized user agent parts', () => {
            const t = tokenizeUserAgent(
                `Mozilla/5.0 (iPad; CPU OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1`
            )
            expect(t.platform.get('mozilla')).toEqual({
                name: 'Mozilla',
                version: {
                    str: '5.0',
                    major: 5,
                    minor: 0,
                    patch: null,
                    build: null,
                },
            })
            expect(t.platform.get('crios')).toEqual({
                name: 'CriOS',
                version: {
                    str: '103.0.5060.63',
                    major: 103,
                    minor: 0,
                    patch: 5060,
                    build: 63,
                },
            })
            expect(t.platform.get('mobile')).toEqual({
                name: 'Mobile',
                version: {
                    str: '15E148',
                    major: 15,
                    minor: 148,
                    patch: null,
                    build: null,
                },
            })
            expect(t.system.get('ipad')).toEqual({
                name: 'iPad',
                version: null,
            })
            expect(t.system.get('cpu', 'os')).toEqual({
                name: 'CPU OS 16_1 like Mac OS X',
                version: {
                    str: '16_1',
                    major: 16,
                    minor: 1,
                    patch: null,
                    build: null,
                },
            })
        })

        it('interprets name and versions in system parts', () => {
            const t = tokenizeUserAgent(
                `(Linux; Android 4.4.2; HTC D816h; CPU iPhone OS 16_3_1 like Mac OS X) (SM-G998U Build/TP1A.220624.014)`
            )
            expect(t.system.get('android')).toEqual({
                name: 'Android 4.4.2',
                version: {
                    str: '4.4.2',
                    major: 4,
                    minor: 4,
                    patch: 2,
                    build: null,
                },
            })
            expect(t.system.get('sm')).toEqual({
                name: 'SM-G998U',
                version: {
                    str: 'TP1A.220624.014',
                    major: 1,
                    minor: 220624,
                    patch: 14,
                    build: null,
                },
            })
            expect(t.system.get('htc')).toEqual({
                name: 'HTC D816h',
                version: {
                    str: 'D816h',
                    major: 816,
                    minor: null,
                    patch: null,
                    build: null,
                },
            })
            expect(t.system.get('iphone')).toEqual({
                name: 'CPU iPhone OS 16_3_1 like Mac OS X',
                version: {
                    str: '16_3_1',
                    major: 16,
                    minor: 3,
                    patch: 1,
                    build: null,
                },
            })
        })
    })

    describe('TokenizedInfo', () => {
        describe('get', () => {
            it('returns parts where all tokens are contained', () => {
                const t = new TokenizedInfo([
                    {
                        name: 'A Big Bunny',
                        version: null,
                        tokens: ['a', 'big', 'bunny'],
                    },
                    {
                        name: 'A Big Hamster',
                        version: null,
                        tokens: ['a', 'big', 'hamster'],
                    },
                ])
                expect(t.get('a')?.name).toBe('A Big Bunny')
                expect(t.get('big')?.name).toBe('A Big Bunny')
                expect(t.get('big', 'cat')).toBeNull()
                expect(t.get('big', 'hamster')?.name).toBe('A Big Hamster')
            })

            describe('when there is an ambiguous match', () => {
                it('returns the match with fewer tokens', () => {
                    const t = new TokenizedInfo([
                        {
                            name: 'One Two Three',
                            version: null,
                            tokens: ['one', 'two', 'three'],
                        },
                        {
                            name: 'One',
                            version: null,
                            tokens: ['one'],
                        },
                        {
                            name: 'One Two',
                            version: null,
                            tokens: ['one', 'two'],
                        },
                    ])
                    expect(t.get('one')?.name).toBe('One')
                    expect(t.get('two')?.name).toBe('One Two')
                    expect(t.get('three')?.name).toBe('One Two Three')
                })
            })
        })

        describe('tokenQuery', () => {
            /**
             * Runs a token query where the predicate matches if all queried tokens are found
             * within a section.
             */
            function test(
                sections: readonly string[][],
                expr: string
            ): string[] | null {
                return tokenQuery(expr, (tokens) => {
                    return sections.find((section) => {
                        return !tokens.some((token) => !section.includes(token))
                    })
                })
            }

            it('returns the part that satisfies the logical expression', () => {
                expect(test([['a'], ['b'], ['c'], ['d']], 'a&b|c&d')).toEqual([
                    'b',
                ])
                expect(test([['a'], ['b'], ['c']], 'a&b|c&d')).toEqual(['b'])
                expect(test([['a'], ['c']], 'a&b|c&d')).toBeNull()
                expect(test([['c'], ['d']], 'a&b|c&d')).toEqual(['d'])
                expect(test([['d'], ['d']], 'a&b|c&d')).toBeNull()
                expect(test([['']], 'a')).toBeNull()
                expect(test([['a']], 'a')).toEqual(['a'])
                expect(test([['d']], 'a&b&c|d')).toEqual(['d'])
                expect(test([['b'], ['c']], 'a&b&c|d')).toBeNull()
                expect(test([['a'], ['b'], ['c']], 'a&b&c|d')).toEqual(['c'])
                expect(test([['a'], ['b'], ['c']], 'a|b|c')).toEqual(['a'])
                expect(test([['c']], 'a|b|c')).toEqual(['c'])
                expect(test([['d']], 'a|b|c')).toBeNull()
                expect(test([['a', 'b']], 'a b')).toEqual(['a', 'b'])
                expect(test([['a', 'b']], 'b a')).toEqual(['a', 'b'])
                expect(
                    test(
                        [
                            ['a', 'b'],
                            ['a', 'b', 'c'],
                        ],
                        'b a c'
                    )
                ).toEqual(['a', 'b', 'c'])
                expect(
                    test(
                        [
                            ['a', 'b'],
                            ['a', 'b', 'c'],
                        ],
                        'b a c d'
                    )
                ).toBeNull()
            })

            it('tokenizes operands, only returning parts that match all', () => {
                const info = new TokenizedInfo([
                    {
                        name: 'A B C',
                        tokens: ['a', 'b', 'c'],
                        version: null,
                    },
                    {
                        name: 'D E',
                        tokens: ['d', 'e'],
                        version: null,
                    },
                ])

                expect(info.query('a b&d e')).not.toBeNull()
                expect(info.query('a b&d e')?.name).toBe('D E')
                expect(info.query('a b d&e')).toBeNull()
                expect(info.query('a b c&d e')).not.toBeNull()
                expect(info.query('a&d e f')).toBeNull()
            })
        })

        describe('query', () => {
            /**
             * Tests an expression on tokenized info with the given parts.
             *
             * @param parts Space delimited, lowercase words.
             * @param expr The expression to test, returns true if the part is found.
             */
            function test(parts: string, expr: string): boolean {
                return (
                    new TokenizedInfo(
                        parts.split(' ').map((word) => {
                            return {
                                name: word,
                                tokens: [word],
                                version: null,
                            }
                        })
                    ).query(expr) != null
                )
            }

            it('returns the part that satisfies the logical expression', () => {
                expect(test('a b c d', 'a&b|c&d')).toBeTrue()
                expect(test('a b c', 'a&b|c&d')).toBeTrue()
                expect(test('a c', 'a&b|c&d')).toBeFalse()
                expect(test('c d', 'a&b|c&d')).toBeTrue()
                expect(test('d d', 'a&b|c&d')).toBeFalse()
                expect(test('', 'a')).toBeFalse()
                expect(test('a', 'a')).toBeTrue()
                expect(test('d', 'a&b&c|d')).toBeTrue()
                expect(test('b c', 'a&b&c|d')).toBeFalse()
                expect(test('a b c', 'a&b&c|d')).toBeTrue()
                expect(test('a b c', 'a|b|c')).toBeTrue()
                expect(test('c', 'a|b|c')).toBeTrue()
                expect(test('d', 'a|b|c')).toBeFalse()
            })

            it('tokenizes operands, only returning parts that match all', () => {
                const info = new TokenizedInfo([
                    {
                        name: 'A B C',
                        tokens: ['a', 'b', 'c'],
                        version: null,
                    },
                    {
                        name: 'D E',
                        tokens: ['d', 'e'],
                        version: null,
                    },
                ])

                expect(info.query('a b&d e')).not.toBeNull()
                expect(info.query('a b&d e')?.name).toBe('D E')
                expect(info.query('a b d&e')).toBeNull()
                expect(info.query('a b c&d e')).not.toBeNull()
                expect(info.query('a&d e f')).toBeNull()
            })
        })
    })
})
