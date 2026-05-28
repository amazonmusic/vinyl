/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    char,
    decodeEntities,
    encodeEntities,
    eqStr,
    isWhitespaceChar,
    type Maybe,
    substitute,
    substituteIdentifiers,
    substringAfterLast,
    substringBefore,
    toKebabCase,
    tokenizeWords,
    toLowerCase,
    toUpperCase,
    truncate,
} from '@amazon/vinyl-util'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('string', () => {
    describe('substitute', () => {
        it('replaces named tokens', () => {
            expect(
                substitute('{a}, {b}, and {c}', {
                    a: 'apples',
                    b: 'bananas',
                    c: 'pears',
                })
            ).toBe('apples, bananas, and pears')
        })

        it('replaces repeat tokens', () => {
            expect(substitute('{x}, {x}, and {x}', { x: 'bananas' })).toBe(
                'bananas, bananas, and bananas'
            )
        })

        it('leaves non-matching text unchanged', () => {
            expect(substitute('no tokens', {})).toBe('no tokens')
        })

        it('supports a custom pattern', () => {
            expect(
                substitute(
                    '{$host}/path',
                    { host: 'https://cdn.example.com' },
                    /\{\$(\w+)}/g
                )
            ).toBe('https://cdn.example.com/path')
        })

        describe('when a variable is not defined', () => {
            it('throws an IllegalArgumentError', () => {
                expect(() => substitute('{missing}', {})).toThrowError(
                    "Variable 'missing' is not defined"
                )
            })
        })
    })

    describe('substituteIdentifiers', () => {
        it('replaces all placeholders correctly', () => {
            expect(
                substituteIdentifiers(
                    'http://example.com/$RepresentationID$/seg_$Number%05d$_$Time%010d$_$Bandwidth$.m4s',
                    {
                        Time: 3600,
                        Number: 5,
                        Bandwidth: 500000,
                        RepresentationID: 'video1',
                    }
                )
            ).toEqual(
                'http://example.com/video1/seg_00005_0000003600_500000.m4s'
            )
        })

        it('correctly applies zero padding to numbers', () => {
            expect(
                substituteIdentifiers(
                    'http://example.com/$RepresentationID$/seg_$Number%03d$_$Time%04d$.m4s',
                    {
                        Time: 60,
                        Number: 7,
                        RepresentationID: 'test',
                        Bandwidth: 0,
                    }
                )
            ).toEqual('http://example.com/test/seg_007_0060.m4s')
        })

        it('unescapes $$ tokens to $', () => {
            expect(
                substituteIdentifiers('This is $$ a $$ test $$', {})
            ).toEqual('This is $ a $ test $')
        })

        it('throws when a template token has no provided replacement value', () => {
            expect(() =>
                substituteIdentifiers('This is $Number$', {})
            ).toThrowError(
                `Template substitution token 'Number' was not understood`
            )
        })
    })

    describe('isWhitespaceChar', () => {
        it('returns a boolean indicating if a char code represents whitespace', () => {
            expect(isWhitespaceChar(char(' '))).toBeTrue()
            expect(isWhitespaceChar(char('\t'))).toBeTrue()
            expect(isWhitespaceChar(char('\r'))).toBeTrue()
            expect(isWhitespaceChar(char('\n'))).toBeTrue()
            expect(isWhitespaceChar(char('a'))).toBeFalse()
            expect(isWhitespaceChar(char('<'))).toBeFalse()
            expect(isWhitespaceChar(char('\v'))).toBeFalse()
            expect(isWhitespaceChar(0)).toBeFalse()
        })
    })

    describe('decodeEntities', () => {
        it('decodes predefined XML entities to a string', () => {
            expect(decodeEntities(`&lt;Hello to y&apos;all&#33;&gt;`)).toBe(
                `<Hello to y'all!>`
            )

            expect(decodeEntities(`&lt;&lt;&lt;&gt;&gt;&gt;`)).toBe(`<<<>>>`)
        })

        it('decodes provided XML entities to a string', () => {
            expect(
                decodeEntities(
                    `&tm; &pound;&pound;`,
                    new Map([
                        ['tm', '™'],
                        ['pound', '£'],
                    ])
                )
            ).toBe(`™ ££`)
        })

        it('replaces named entities case-insensitively', () => {
            expect(decodeEntities(`&QuOT;Hello&qUOt;`)).toBe(`"Hello"`)
        })

        it('returns the original string if no entities', () => {
            expect(decodeEntities(`a quick brown fox`)).toBe(
                `a quick brown fox`
            )
        })

        it('ignores named entities not found', () => {
            expect(decodeEntities(`&missing;`)).toBe(`&missing;`)
        })
    })

    describe('encodeEntities', () => {
        it('encodes predefined XML entities to a string', () => {
            expect(encodeEntities(`<Hello to y'all!>`)).toBe(
                `&lt;Hello to y&apos;all!&gt;`
            )

            expect(encodeEntities(`<<<>>>`)).toBe(`&lt;&lt;&lt;&gt;&gt;&gt;`)
            expect(encodeEntities('Hello')).toBe('Hello')
        })

        it('replaces named entities case-insensitively', () => {
            expect(encodeEntities(`"Hello"`)).toBe(`&quot;Hello&quot;`)
        })
    })

    describe('eqStr', () => {
        it('returns true if null is passed', () => {
            expect(eqStr(null, null)).toBeTrue()
            expect(eqStr(null, null, true)).toBeTrue()
            expect(eqStr(null, 'null', true)).toBeFalse()
        })

        it('returns true if strings match', () => {
            expect(eqStr('test', 'test')).toBeTrue()
            expect(eqStr('Test', 'test')).toBeFalse()
        })

        it('returns false if one string is null', () => {
            expect(eqStr(null, 'test')).toBeFalse()
            expect(eqStr('test', null)).toBeFalse()
        })

        it('returns true if strings match case-insensitively', () => {
            expect(eqStr('Test', 'test', true)).toBeTrue()
            expect(eqStr('test', 'test', true)).toBeTrue()
            expect(eqStr('test', 'tested', true)).toBeFalse()
            expect(eqStr('tested', 'test', true)).toBeFalse()
            expect(eqStr('tEsT', 'teSt', true)).toBeTrue()
            expect(eqStr('cat', 'dog', true)).toBeFalse()
        })
    })

    describe('char', () => {
        it('returns the char code of the first character', () => {
            expect(char('a')).toBe(97)
            expect(char('A')).toBe(65)
            expect(char(' ')).toBe(32)
        })
    })

    describe('substringAfterLast', () => {
        it('returns the substring after the last instance of search, not including search', () => {
            expect(substringAfterLast('a quick brown fox', 'brown ')).toBe(
                'fox'
            )
            expect(substringAfterLast('aaaabbb', 'a')).toBe('bbb')
            expect(substringAfterLast('whole string', 'notfound')).toBe(
                'whole string'
            )
            expect(substringAfterLast('com.example.foo', '.')).toBe('foo')
        })

        describe('when caseSensitive is false', () => {
            it(
                'returns the substring after the last instance of case insensitive search,' +
                    ' not including search',
                () => {
                    expect(
                        substringAfterLast('a quick browN fox', 'BrOwn ', false)
                    ).toBe('fox')
                    expect(substringAfterLast('aaAabBb', 'A', false)).toBe(
                        'bBb'
                    )
                    expect(
                        substringAfterLast('whole string', 'notfound', false)
                    ).toBe('whole string')
                }
            )
        })
    })

    describe('substringBefore', () => {
        it(
            'returns the substring before the first instance of search, not including' +
                ' search',
            () => {
                expect(substringBefore('a quick brown fox', ' brown')).toBe(
                    'a quick'
                )
                expect(substringBefore('aaaabbb', 'a')).toBe('')
                expect(substringBefore('aaaabbb', 'b')).toBe('aaaa')
                expect(substringBefore('whole string', 'notfound')).toBe(
                    'whole string'
                )
                expect(substringBefore('com.example.foo', '.')).toBe('com')
            }
        )

        describe('when caseSensitive is false', () => {
            it(
                'returns the substring after the last instance of case insensitive search,' +
                    ' not including search',
                () => {
                    expect(
                        substringBefore('a Quick browN fox', ' BrOwn', false)
                    ).toBe('a Quick')
                    expect(substringBefore('aaAabBb', 'B', false)).toBe('aaAa')
                    expect(
                        substringBefore('whole string', 'notfound', false)
                    ).toBe('whole string')
                }
            )
        })
    })

    describe('tokenizeWords', () => {
        it('returns a set of lowercase alphanumeric words', () => {
            expect(tokenizeWords('One/ Two-+Three   4')).toEqual([
                'one',
                'two',
                'three',
                '4',
            ])
            expect(tokenizeWords('Foo123')).toEqual(['foo123'])
            expect(tokenizeWords('Foo123.Bar444')).toEqual(['foo123', 'bar444'])
            expect(tokenizeWords('Amazon Music x86_64')).toEqual([
                'amazon',
                'music',
                'x86',
                '64',
            ])
        })
    })

    describe('toLowercase', () => {
        it('returns string.toLowercase as Lowercase type', () => {
            const test: 'test' = toLowerCase('TesT')
            expect(test).toEqual('test')
            // @ts-expect-error Expect type error
            const test2: 'TesT' = toLowerCase('TesT')
            expect(test2).toEqual('test')
        })
    })

    describe('toUppercase', () => {
        it('returns string.toUppercase as Uppercase type', () => {
            const test: 'TEST' = toUpperCase('TesT')
            expect(test).toEqual('TEST')
            // @ts-expect-error Expect type error
            const test2: 'TesT' = toUpperCase('TesT')
            expect(test2).toEqual('TEST')
        })
    })

    describe('truncate', () => {
        it('truncates a string with a truncation indicator if greater than max length', () => {
            expect(truncate('a very long string', 10)).toEqual('a very lo…')
            expect(truncate('a very long string', 20)).toEqual(
                'a very long string'
            )
            expect(truncate('Truncate me', 6, '!')).toEqual('Trunc!')
            expect(truncate('Truncate me', 0, '!')).toEqual('!')
        })

        describe('when string input is nullish', () => {
            it('returns the nullish input', () => {
                expect(truncate(null, 1)).toBeNull()
                expect(truncate(undefined, 1)).toBeUndefined()
            })
        })

        describe('when string input is non-nullable', () => {
            it('returns a non-nullable string type', () => {
                const _str = truncate('', 1)
                expectTypeStrictlyEquals<typeof _str, string>(true)
                const _nullReturn = truncate(null, 1)
                expectTypeStrictlyEquals<typeof _nullReturn, string | null>(
                    true
                )
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                const input: Maybe<string> = null as any // cast as any to prevent type narrowing
                const _maybeReturn = truncate(input, 1)
                expectTypeStrictlyEquals<typeof _maybeReturn, Maybe<string>>(
                    true
                )
            })
        })
    })

    describe('toKebabCase', () => {
        it('converts camelCase to kebab-case', () => {
            expect(toKebabCase('someVariableName')).toBe('some-variable-name')
        })

        it('converts PascalCase to kebab-case', () => {
            expect(toKebabCase('SomeVariableName')).toBe('some-variable-name')
        })

        it('converts snake_case to kebab-case', () => {
            expect(toKebabCase('some_variable_name')).toBe('some-variable-name')
        })

        it('converts space-separated words to kebab-case', () => {
            expect(toKebabCase('some variable name')).toBe('some-variable-name')
        })

        it('collapses multiple adjacent delimiters into a single hyphen', () => {
            expect(toKebabCase('a__b  c---d')).toBe('a-b-c-d')
        })

        it('trims leading and trailing delimiters', () => {
            expect(toKebabCase('__hello-world__')).toBe('hello-world')
        })

        it('returns lowercase output', () => {
            expect(toKebabCase('MyCustomName')).toBe('my-custom-name')
        })

        it('leaves already kebab-case strings unchanged', () => {
            expect(toKebabCase('already-kebab-case')).toBe('already-kebab-case')
        })

        it('returns empty string when input is empty', () => {
            expect(toKebabCase('')).toBe('')
        })
    })
})
