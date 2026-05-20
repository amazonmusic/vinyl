/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    codeLocationComparator,
    createRangeFromErrorMarkers,
    isCodeLocationInRange,
    parseStackLocation,
    stackNoise,
    stackNoiseError1,
    stackNoiseError2,
} from '@amazon/vinyl-util'

describe('stack', () => {
    describe('codeLocationComparator', () => {
        it('compares by file, then row, then col', () => {
            expect(
                codeLocationComparator(
                    { source: null, row: 4, col: 30, file: 'a/to' },
                    { source: null, row: 4, col: 30, file: 'b/to' }
                )
            ).toBe(-1)

            expect(
                codeLocationComparator(
                    { source: null, row: 4, col: 30, file: 'a/b' },
                    { source: null, row: 4, col: 30, file: 'a/a' }
                )
            ).toBe(1)

            expect(
                codeLocationComparator(
                    { source: null, row: 4, col: 30, file: 'b' },
                    { source: null, row: 3, col: 60, file: 'b' }
                )
            ).toBe(1)

            expect(
                codeLocationComparator(
                    { source: null, row: 3, col: 30, file: 'b' },
                    { source: null, row: 3, col: 60, file: 'b' }
                )
            ).toBe(-1)
        })
    })

    describe('isCodeLocationInRange', () => {
        it('returns false if start and end are null', () => {
            expect(
                isCodeLocationInRange(
                    { source: null, row: 100, col: 30, file: 'b' },
                    {
                        start: null,
                        end: null,
                    }
                )
            ).toBeFalse()
        })

        it('returns false if location is null', () => {
            expect(
                isCodeLocationInRange(null, {
                    start: { source: null, row: 3, col: 30, file: 'b' },
                    end: { source: null, row: 100, col: 30, file: 'b' },
                })
            ).toBeFalse()
        })

        it('returns true if location is within start and end boundaries', () => {
            expect(
                isCodeLocationInRange(
                    { source: null, row: 4, col: 30, file: 'b' },
                    {
                        start: {
                            source: null,
                            row: 3,
                            col: 30,
                            file: 'b',
                        },
                        end: {
                            source: null,
                            row: 5,
                            col: 30,
                            file: 'b',
                        },
                    }
                )
            ).toBeTrue()

            expect(
                isCodeLocationInRange(
                    { source: null, row: 4, col: 31, file: 'b' },
                    {
                        start: {
                            source: null,
                            row: 3,
                            col: 30,
                            file: 'b',
                        },
                        end: {
                            source: null,
                            row: 4,
                            col: 32,
                            file: 'b',
                        },
                    }
                )
            ).toBeTrue()
        })

        it('returns true if location is equal to start boundary and before end boundary', () => {
            expect(
                isCodeLocationInRange(
                    { source: null, row: 4, col: 30, file: 'b' },
                    {
                        start: {
                            source: null,
                            row: 4,
                            col: 30,
                            file: 'b',
                        },
                        end: {
                            source: null,
                            row: 5,
                            col: 30,
                            file: 'b',
                        },
                    }
                )
            ).toBeTrue()
        })

        it('returns false if location is equal to end boundary', () => {
            expect(
                isCodeLocationInRange(
                    { source: null, row: 5, col: 30, file: 'b' },
                    {
                        start: {
                            source: null,
                            row: 4,
                            col: 30,
                            file: 'b',
                        },
                        end: {
                            source: null,
                            row: 5,
                            col: 30,
                            file: 'b',
                        },
                    }
                )
            ).toBeFalse()
        })

        it('returns false if location is outside of start and end boundaries', () => {
            expect(
                isCodeLocationInRange(
                    { source: null, row: 3, col: 30, file: 'a/b' },
                    {
                        start: {
                            source: null,
                            row: 4,
                            col: 30,
                            file: 'a/b',
                        },
                        end: {
                            source: null,
                            row: 5,
                            col: 30,
                            file: 'a/b',
                        },
                    }
                )
            ).toBeFalse()

            expect(
                isCodeLocationInRange(
                    { source: null, row: 6, col: 30, file: 'a/b' },
                    {
                        start: {
                            source: null,
                            row: 4,
                            col: 30,
                            file: 'a/b',
                        },
                        end: {
                            source: null,
                            row: 5,
                            col: 30,
                            file: 'a/b',
                        },
                    }
                )
            ).toBeFalse()

            expect(
                isCodeLocationInRange(
                    {
                        source: null,
                        row: 5,
                        col: 30,
                        file: 'a/otherfile',
                    },
                    {
                        start: {
                            source: null,
                            row: 4,
                            col: 30,
                            file: 'a/b',
                        },
                        end: {
                            source: null,
                            row: 6,
                            col: 30,
                            file: 'a/b',
                        },
                    }
                )
            ).toBeFalse()
        })
    })

    describe('parseStackLocation', () => {
        describe('when stack is Firefox or Safari style', () => {
            it('returns a parsed stack', () => {
                expect(
                    parseStackLocation(
                        `global code@https://example.com/?editor_console=true:111:23`
                    )
                ).toEqual({
                    source: 'global code',
                    row: 111,
                    col: 23,
                    file: 'https://example.com/?editor_console=true',
                })

                expect(
                    parseStackLocation(
                        `testMe@http://localhost:8001/test.js:3:22
                               @http://localhost:8001/test.js:7:1`
                    )
                ).toEqual({
                    source: 'testMe',
                    row: 3,
                    col: 22,
                    file: 'http://localhost:8001/test.js',
                })
            })
        })

        describe('when stack is V8/Chakra style with source location', () => {
            it('returns a parsed stack', () => {
                expect(
                    parseStackLocation(
                        `An Error
                        at ./src/globalErrorHandling.ts (http://localhost:4321/__src__/index.umd.js:1041:26)`
                    )
                ).toEqual({
                    source: './src/globalErrorHandling.ts',
                    row: 1041,
                    col: 26,
                    file: 'http://localhost:4321/__src__/index.umd.js',
                })
            })
        })

        describe('when stack is V8/Chakra style without source location', () => {
            it('returns a parsed stack', () => {
                expect(
                    parseStackLocation(
                        `Error: test
        at http://localhost:8001/:15:20`
                    )
                ).toEqual({
                    source: null,
                    row: 15,
                    col: 20,
                    file: 'http://localhost:8001/',
                })

                expect(
                    parseStackLocation(
                        `Error: test
        at http://localhost:8001/:15`
                    )
                ).toEqual({
                    source: null,
                    row: 15,
                    col: null,
                    file: 'http://localhost:8001/',
                })

                expect(
                    parseStackLocation(
                        `Error 
                        at eval code (eval code:1:2)`
                    )
                ).toEqual({
                    source: 'eval code',
                    row: 1,
                    col: 2,
                    file: 'eval code',
                })
            })
        })

        describe('when stack is invalid', () => {
            it('returns null', () => {
                // file missing
                expect(parseStackLocation(`:4:1`)).toBeNull()
            })
        })

        describe('when stack is falsy', () => {
            it('returns null', () => {
                expect(parseStackLocation()).toBeNull()
                expect(parseStackLocation(undefined)).toBeNull()
                expect(parseStackLocation(null)).toBeNull()
            })
        })

        describe('when stack begins with noise from polyfill', () => {
            const noise =
                'An Error\n at ./src/noise.ts' +
                ' (http://localhost:4321/__src__/noise.umd.js:1:2)\n'
            beforeEach(() => {
                stackNoise.value = noise
            })

            it('trims noise', () => {
                expect(
                    parseStackLocation(
                        `${noise}
                        at ./src/globalErrorHandling.ts (http://localhost:4321/__src__/index.umd.js:1041:26)`
                    )
                ).toEqual({
                    source: './src/globalErrorHandling.ts',
                    row: 1041,
                    col: 26,
                    file: 'http://localhost:4321/__src__/index.umd.js',
                })
            })
        })

        describe('when stack does not begin with noise from polyfill', () => {
            const noise =
                'An Error\n at ./src/noise.ts' +
                ' (http://localhost:4321/__src__/noise.umd.js:1:2)\n'
            beforeEach(() => {
                stackNoise.value = noise
            })

            it('does not trim noise', () => {
                expect(
                    parseStackLocation(
                        `at ./src/globalErrorHandling.ts (http://localhost:4321/__src__/index.umd.js:1041:26)`
                    )
                ).toEqual({
                    source: './src/globalErrorHandling.ts',
                    row: 1041,
                    col: 26,
                    file: 'http://localhost:4321/__src__/index.umd.js',
                })
            })
        })
    })

    describe('createRangeFromErrorMarkers', () => {
        it('creates a range object from the parsed error stacks', () => {
            expect(
                createRangeFromErrorMarkers(
                    {
                        stack: '@global:4:1',
                        name: '',
                        message: '',
                    },
                    {
                        stack: '@global:5:30',
                        name: '',
                        message: '',
                    }
                )
            ).toEqual({
                start: { source: null, row: 4, col: 1, file: 'global' },
                end: { source: null, row: 5, col: 30, file: 'global' },
            })
        })

        it('has null start or end values when markers are undefined', () => {
            expect(createRangeFromErrorMarkers(undefined, undefined)).toEqual({
                start: null,
                end: null,
            })
        })
    })

    describe('stackNoise', () => {
        beforeEach(() => {
            stackNoise.clear()
        })

        afterEach(() => {
            stackNoise.clear()
            delete stackNoiseError1.stack
            delete stackNoiseError2.stack
        })

        it('returns the lines common between two errors in the same file', () => {
            stackNoiseError1.stack = `first line\nsecond line\nunique line 1`
            stackNoiseError2.stack = `first line\nsecond line\nunique line 2`
            expect(stackNoise.value).toBe('first line\nsecond line\n')
        })

        it('returns an empty string if stack is not defined', () => {
            delete stackNoiseError1.stack
            delete stackNoiseError2.stack
            expect(stackNoise.value).toBe('')
        })
    })
})
