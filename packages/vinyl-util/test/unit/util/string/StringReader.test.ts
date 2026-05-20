/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    char,
    ErrorLevel,
    ErrorOrigin,
    ReportableError,
    StringParseError,
    StringReader,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('StringReader', () => {
    describe('hasNext', () => {
        it('returns true when position is less than length', () => {
            const r = new StringReader('123')
            expect(r.hasNext()).toBeTrue() // 1
            r.next()
            expect(r.hasNext()).toBeTrue() // 2
            r.next()
            expect(r.hasNext()).toBeTrue() // 3
            r.next()
            expect(r.hasNext()).toBeFalse()
        })
    })

    describe('remaining', () => {
        it('returns the data length minus position', () => {
            const r = new StringReader('123')
            expect(r.remaining).toBe(3)
            r.next()
            expect(r.remaining).toBe(2)
            r.next()
            expect(r.remaining).toBe(1)
            r.next()
            expect(r.remaining).toBe(0)
        })
    })

    describe('length', () => {
        it('returns the data length', () => {
            const r = new StringReader('123')
            expect(r.length).toBe(3)
            r.next()
            expect(r.length).toBe(3)
        })
    })

    describe('err', () => {
        it('throws a StringParseError', () => {
            const r = new StringReader(
                'This is a\nTest of the error parsing system\nThis is only a test'
            )
            expect(() => r.err('TestMessage')).toThrowMatching((e) => {
                expect(e).toBeInstanceOf(StringParseError)
                expect(e).toEqual(
                    objectContaining({
                        position: 0,
                        reason: 'TestMessage',
                        location: 'This is a\n^',
                    })
                )
                expect(e.origin).toEqual(ErrorOrigin.PARSING)
                return true
            })
        })

        it('accepts an offset', () => {
            const r = new StringReader(
                'This is a\nTest of the error parsing system\nThis is only a test'
            )
            r.position += 11
            expect(() => r.err('TestMessage', -5)).toThrowMatching((e) => {
                return e instanceof StringParseError && e.position === 6
            })
        })
    })

    describe('next', () => {
        it('returns the next character and advances position by one', () => {
            const r = new StringReader('123')
            const c = r.next()
            expect(c).toEqual(char('1'))
            expect(r.position).toEqual(1)
            const c2 = r.next()
            expect(c2).toEqual(char('2'))
            expect(r.position).toEqual(2)
        })

        it('returns NaN when out of bounds', () => {
            const r = new StringReader('')
            expect(r.next()).toBeNaN()
        })
    })

    describe('while', () => {
        it('increments position while the predicate is true', () => {
            const r = new StringReader('0123456')
            r.while((c) => c < char('4'))
            expect(r.position).toBe(4)
        })

        it('increments until the end of the stream if the predicate is always true', () => {
            const r = new StringReader('0123456')
            const start = r.while(() => true)
            expect(r.position).toBe(7)
            expect(start).toBe(0)
        })
    })

    describe('until', () => {
        it('increments position while the predicate is false', () => {
            const r = new StringReader('0123456')
            const start = r.until((c) => c === char('4'))
            expect(r.position).toBe(4)
            expect(start).toBe(0)
            const start2 = r.until((c) => c === char('6'))
            expect(r.position).toBe(6)
            expect(start2).toBe(4)
        })

        it('increments until the end of the stream if the predicate is always false', () => {
            const r = new StringReader('0123456')
            r.until(() => false)
            expect(r.position).toBe(7)
        })
    })

    describe('untilString', () => {
        it('increments position while the predicate is false', () => {
            const r = new StringReader('0123456')
            {
                const start = r.untilString('012')
                expect(r.position).toBe(0)
                expect(start).toBe(0)
            }
            {
                const start = r.untilString('234')
                expect(r.position).toBe(2)
                expect(start).toBe(0)
            }
            {
                const start = r.untilString('4')
                expect(r.position).toBe(4)
                expect(start).toBe(2)
            }
            {
                const start = r.untilString('56x')
                expect(r.position).toBe(7)
                expect(start).toBe(4)
            }
        })

        it('increments until the end of the stream if the string is never found', () => {
            const r = new StringReader('0123456')
            r.untilString('a')
            expect(r.position).toBe(7)
        })
    })

    describe('untilChar', () => {
        it('increments position until the given char code is found', () => {
            const r = new StringReader('0123456')
            const start = r.untilChar(char('4'))
            expect(r.position).toBe(4)
            expect(start).toBe(0)
            const start2 = r.untilChar(char('6'))
            expect(r.position).toBe(6)
            expect(start2).toBe(4)
        })

        it('increments until the end of the stream if the character is not found', () => {
            const r = new StringReader('0123456')
            const start = r.untilChar(char('7'))
            expect(r.position).toBe(7)
            expect(start).toBe(0)
        })
    })

    describe('substringWhile', () => {
        it('returns a substring from start until the predicate returns false', () => {
            const r = new StringReader('0123456')
            expect(r.substringWhile((c) => c < char('4'))).toBe('0123')
            expect(r.substringWhile(() => true)).toBe('456')
        })
    })

    describe('substringUntil', () => {
        it('returns a substring from start until the predicate returns false', () => {
            const r = new StringReader('0123456')
            expect(r.substringUntil((c) => c >= char('4'))).toBe('0123')
            expect(r.substringUntil(() => false)).toBe('456')
        })
    })

    describe('substringUntilChar', () => {
        it('returns a substring from start until the specified character code', () => {
            const r = new StringReader('012345678')
            expect(r.substringUntilChar(char('4'))).toBe('0123')
            expect(r.substringUntilChar(char('7'))).toBe('456')
            expect(r.substringUntilChar(-1)).toBe('78')
        })
    })

    describe('substr', () => {
        it('returns a substring from start until the given length', () => {
            const r = new StringReader('0123456')
            expect(r.substr(4)).toBe('0123')
            expect(r.substr(5)).toBe('456')
        })
    })

    describe('read', () => {
        it('advances on a match', () => {
            const r = new StringReader('0123456')
            expect(r.read('0123')).toBe('0123')
            expect(r.read('456')).toBe('456')
        })

        it('advances on a case-insensitive match', () => {
            const r = new StringReader('aBCdEfG')
            expect(r.read('AbCD', true)).toBe('aBCd')
            expect(r.read('EFg', true)).toBe('EfG')
        })

        it('throws when ignoreCase is false and the match differs by case', () => {
            const r = new StringReader('aBCdEfG')
            expect(() => r.read('AbCD')).toThrowMatching(isParseError)
        })

        it('throws when ignoreCase is true and there is no match', () => {
            const r = new StringReader('aBCdEfG')
            expect(() => r.read('abcw')).toThrowMatching(isParseError)
        })
    })

    describe('readChar', () => {
        it('advances on a match', () => {
            const r = new StringReader('0123456')
            expect(r.readChar(char('0'))).toBe(char('0'))
            expect(r.readChar(char('1'))).toBe(char('1'))
        })

        it('throws when the character is not a match', () => {
            const r = new StringReader('0123456')
            expect(() => r.readChar(char('1'))).toThrowMatching(isParseError)
        })
    })

    describe('peek', () => {
        it('reads the next character without advancing', () => {
            const r = new StringReader('aBCdEfG')
            expect(r.peek).toBe(char('a'))
            expect(r.peek).toBe(char('a'))
            r.next()
            expect(r.peek).toBe(char('B'))
            expect(r.peek).toBe(char('B'))
        })

        it('returns NaN when out of bounds', () => {
            const r = new StringReader('')
            expect(r.peek).toBeNaN()
        })
    })

    describe('white', () => {
        it('reads all whitespace characters', () => {
            const r = new StringReader('\t \r\nTest')
            const start = r.white()
            expect(start).toBe(0)
            expect(r.peek).toBe(char('T'))
        })
    })

    describe('charIf', () => {
        it('returns true and advances if the character code matches', () => {
            const r = new StringReader('abc')
            expect(r.charIf(char('a'))).toBe(true)
            expect(r.charIf(char('z'))).toBe(false)
            expect(r.charIf(char('b'))).toBe(true)
            expect(r.charIf(char('z'))).toBe(false)
            expect(r.charIf(char('c'))).toBe(true)
            expect(r.charIf(0)).toBe(false)
        })
    })

    describe('stringIf', () => {
        it('returns true and advances if the string matches', () => {
            const r = new StringReader('abcDefGHiJ')
            expect(r.stringIf('abc')).toBe(true)
            expect(r.stringIf('DEF')).toBe(false)
            expect(r.stringIf('Def')).toBe(true)
            expect(r.stringIf('GHi', false)).toBe(true)
            expect(r.stringIf('GHi', true)).toBe(false)
            expect(r.stringIf('j')).toBe(false)
            expect(r.stringIf('j', true)).toBe(true)
            expect(r.stringIf('j', true)).toBe(false)
        })
    })
})

describe('StringParseError', () => {
    it('is an instance of Error and StringParseError', () => {
        expectPrototype(
            () => new StringParseError('source string', 0, 'reason'),
            StringParseError,
            ReportableError,
            Error
        )
    })

    it('is serializable', () => {
        const e = new StringParseError('source string', 1, 'reason')
        expect(e.toJSON()).toEqual({
            name: 'StringParseError',
            message: e.message,
            origin: ErrorOrigin.PARSING,
            level: ErrorLevel.FATAL,
            position: e.position,
            reason: e.reason,
            location: e.location,
            stack: e.stack,
        })
    })

    describe('message', () => {
        it('has reason and location', () => {
            const s = new StringParseError('source string', 0, 'reason')
            expect(s.message).toBe(`reason, at: \nsource string\n^`)
        })
    })

    describe('toJSON', () => {
        it('returns a serializable representation', () => {
            const s = new StringParseError('source string', 0, 'reason')
            expect(s.toJSON()).toEqual({
                name: 'StringParseError',
                message: any(String),
                origin: ErrorOrigin.PARSING,
                level: ErrorLevel.FATAL,
                stack: any(String),
                position: 0,
                location: s.location,
                reason: 'reason',
            })
        })
    })
})

const isParseError = (e: any) => e instanceof StringParseError
