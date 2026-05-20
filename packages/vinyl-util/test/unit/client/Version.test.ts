/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    compareVersions,
    compareVersionsStrict,
    parseVersion,
} from '@amazon/vinyl-util'

describe('Version', () => {
    describe('extractVersion', () => {
        it('returns null when str is falsy', () => {
            expect(parseVersion(null)).toBeNull()
            expect(parseVersion(undefined)).toBeNull()
            expect(parseVersion('')).toBeNull()
        })

        it('returns null when str is not a version string', () => {
            expect(parseVersion('abc')).toBeNull()
        })

        it('returns a parsed version from a string', () => {
            expect(parseVersion('Intel Mac OS X 10.15')).toEqual({
                str: '10.15',
                major: 10,
                minor: 15,
                patch: null,
                build: null,
            })

            expect(parseVersion('Build v12.34.beta Extra')).toEqual({
                str: 'v12.34.beta',
                major: 12,
                minor: 34,
                patch: null,
                build: null,
            })

            expect(parseVersion('Build (123) Extra')).toEqual({
                str: '123',
                major: 123,
                minor: null,
                patch: null,
                build: null,
            })

            expect(parseVersion('Version1.2.3.4')).toEqual({
                str: 'Version1.2.3.4',
                major: 1,
                minor: 2,
                patch: 3,
                build: 4,
            })

            expect(
                parseVersion(
                    'A string with a version: Version1.2.3.4-beta-gamma-delta Extra'
                )
            ).toEqual({
                str: 'Version1.2.3.4-beta-gamma-delta',
                major: 1,
                minor: 2,
                patch: 3,
                build: 4,
            })
        })
    })

    describe('compareVersionsStrict', () => {
        it('compares two version objects', () => {
            expect(
                compareVersionsStrict(
                    {
                        str: '123',
                        major: 123,
                        minor: null,
                        patch: null,
                        build: null,
                    },
                    {
                        str: '123',
                        major: 123,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(0)

            expect(
                compareVersionsStrict(
                    {
                        str: '1.0',
                        major: 1,
                        minor: 0,
                        patch: null,
                        build: null,
                    },
                    {
                        str: '1',
                        major: 1,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(1)

            expect(
                compareVersionsStrict(
                    {
                        str: '',
                        major: 1,
                        minor: null,
                        patch: null,
                        build: null,
                    },
                    {
                        str: '',
                        major: 2,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(-1)
            expect(
                compareVersionsStrict(
                    {
                        str: '',
                        major: 1,
                        minor: 2,
                        patch: null,
                        build: null,
                    },
                    {
                        str: '',
                        major: 1,
                        minor: 1,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(1)
            expect(
                compareVersionsStrict(
                    {
                        str: '',
                        major: 1,
                        minor: 1,
                        patch: 1,
                        build: null,
                    },
                    {
                        str: '',
                        major: 1,
                        minor: 1,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(1)
            expect(
                compareVersionsStrict(
                    {
                        str: '',
                        major: 1,
                        minor: 1,
                        patch: 1,
                        build: 2,
                    },
                    {
                        str: '',
                        major: 1,
                        minor: 1,
                        patch: 1,
                        build: 3,
                    }
                )
            ).toBe(-1)

            expect(
                compareVersionsStrict(null, {
                    str: '',
                    major: 1,
                    minor: 1,
                    patch: 1,
                    build: 3,
                })
            ).toBe(-1)

            expect(
                compareVersionsStrict(
                    {
                        str: '1.2.3.4-a',
                        major: 1,
                        minor: 2,
                        patch: 3,
                        build: 4,
                    },
                    {
                        str: '1.2.3.4-b',
                        major: 1,
                        minor: 2,
                        patch: 3,
                        build: 4,
                    }
                )
            ).toBe(-1)

            expect(
                compareVersionsStrict(
                    {
                        str: '1.2.3.4-c',
                        major: 1,
                        minor: 2,
                        patch: 3,
                        build: 4,
                    },
                    {
                        str: '1.2.3.4-c',
                        major: 1,
                        minor: 2,
                        patch: 3,
                        build: 4,
                    }
                )
            ).toBe(0)
        })
    })

    describe('compareVersions', () => {
        it('compares two version objects, considering null sections as zero', () => {
            expect(
                compareVersions(
                    {
                        str: '1.0',
                        major: 1,
                        minor: 0,
                        patch: null,
                        build: null,
                    },
                    {
                        str: '1',
                        major: 1,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(0)

            expect(
                compareVersions(
                    {
                        str: '1.0.1',
                        major: 1,
                        minor: 0,
                        patch: 1,
                        build: null,
                    },
                    {
                        str: '1',
                        major: 1,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(1)

            expect(
                compareVersions(
                    {
                        str: '1.0.0.0',
                        major: 1,
                        minor: 0,
                        patch: 0,
                        build: 0,
                    },
                    {
                        str: '1',
                        major: 1,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(0)

            expect(
                compareVersions(
                    {
                        str: '1.0.0.1',
                        major: 1,
                        minor: 0,
                        patch: 0,
                        build: 1,
                    },
                    {
                        str: '1',
                        major: 1,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(1)

            expect(
                compareVersions(
                    {
                        str: '2.0.0.4',
                        major: 1,
                        minor: 0,
                        patch: 0,
                        build: 4,
                    },
                    {
                        str: '3',
                        major: 3,
                        minor: null,
                        patch: null,
                        build: null,
                    }
                )
            ).toBe(-1)
        })
    })
})
