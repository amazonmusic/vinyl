/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type CommonEme,
    commonEmeFactory,
    type MediaKeySupport,
    mediaKeySupportRef,
    MsCommonEme,
    StandardCommonEme,
    WebKitCommonEme,
} from '@amazon/vinyl'
import { overrideGlobalInit } from '@amazon/vinyl-util/testUtil'

type CommonEmeClass = abstract new (...args: never[]) => CommonEme

function useMediaKeySupport(support: Partial<MediaKeySupport>) {
    overrideGlobalInit(mediaKeySupportRef, () => ({
        standardEme: false,
        webkitEme: false,
        msEme: false,
        ...support,
    }))
}

function describeSupport(support: MediaKeySupport): string {
    const supported = [
        support.standardEme && 'standard',
        support.webkitEme && 'WebKit',
        support.msEme && 'MS',
    ].filter(Boolean)
    return supported.length ? supported.join(' + ') : 'none'
}

// Every combination of supported EME implementations, with the expected
// implementation when standard is preferred and when prefixed is preferred.
const cases: readonly {
    readonly support: MediaKeySupport
    readonly preferStandard: CommonEmeClass | null
    readonly preferPrefixed: CommonEmeClass | null
}[] = [
    {
        support: { standardEme: false, webkitEme: false, msEme: false },
        preferStandard: null,
        preferPrefixed: null,
    },
    {
        support: { standardEme: true, webkitEme: false, msEme: false },
        preferStandard: StandardCommonEme,
        preferPrefixed: StandardCommonEme,
    },
    {
        support: { standardEme: false, webkitEme: true, msEme: false },
        preferStandard: WebKitCommonEme,
        preferPrefixed: WebKitCommonEme,
    },
    {
        support: { standardEme: false, webkitEme: false, msEme: true },
        preferStandard: MsCommonEme,
        preferPrefixed: MsCommonEme,
    },
    {
        support: { standardEme: true, webkitEme: true, msEme: false },
        preferStandard: StandardCommonEme,
        preferPrefixed: WebKitCommonEme,
    },
    {
        support: { standardEme: true, webkitEme: false, msEme: true },
        preferStandard: StandardCommonEme,
        preferPrefixed: MsCommonEme,
    },
    {
        support: { standardEme: false, webkitEme: true, msEme: true },
        preferStandard: WebKitCommonEme,
        preferPrefixed: WebKitCommonEme,
    },
    {
        support: { standardEme: true, webkitEme: true, msEme: true },
        preferStandard: StandardCommonEme,
        preferPrefixed: WebKitCommonEme,
    },
]

// Only `true` opts in to prefixed EME; unset, null, and false all keep the
// standard-first default.
const preferStandardCases: readonly {
    readonly label: string
    readonly create: () => CommonEme | null
}[] = [
    { label: 'no options', create: () => commonEmeFactory() },
    { label: 'undefined options', create: () => commonEmeFactory(undefined) },
    { label: 'null options', create: () => commonEmeFactory(null) },
    { label: 'empty options', create: () => commonEmeFactory({}) },
    ...[undefined, null, false].map((preferPrefixedMediaKeys) => ({
        label: `preferPrefixedMediaKeys: ${String(preferPrefixedMediaKeys)}`,
        create: () => commonEmeFactory({ preferPrefixedMediaKeys }),
    })),
]

function expectEme(eme: CommonEme | null, expected: CommonEmeClass | null) {
    if (expected == null) {
        expect(eme).toBeNull()
    } else {
        expect(eme).toBeInstanceOf(expected)
    }
}

describe('commonEmeFactory', () => {
    for (const { support, preferStandard, preferPrefixed } of cases) {
        describe(`when ${describeSupport(support)} EME is supported`, () => {
            useMediaKeySupport(support)

            for (const { label, create } of preferStandardCases) {
                it(`returns ${preferStandard?.name ?? 'null'} given ${label}`, () => {
                    expectEme(create(), preferStandard)
                })
            }

            it(`returns ${preferPrefixed?.name ?? 'null'} given preferPrefixedMediaKeys: true`, () => {
                expectEme(
                    commonEmeFactory({ preferPrefixedMediaKeys: true }),
                    preferPrefixed
                )
            })
        })
    }
})
