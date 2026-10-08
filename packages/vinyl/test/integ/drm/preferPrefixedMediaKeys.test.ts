/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmKeySystem, type VinylPlayer } from '@amazon/vinyl'
import { createVinylSuite } from '@amazon/vinyl/vinylTestUtil'
import type { Maybe } from '@amazon/vinyl-util'

type EmeImplementation = 'standard' | 'webkit' | 'ms'

/** EME implementations exposed by the browser running the spec. */
function browserEmeSupport(): ReadonlySet<EmeImplementation> {
    const support = new Set<EmeImplementation>()
    if (typeof MediaKeys !== 'undefined') support.add('standard')
    if (typeof WebKitMediaKeys !== 'undefined') support.add('webkit')
    if (typeof (globalThis as any).MSMediaKeys !== 'undefined')
        support.add('ms')
    return support
}

/**
 * The implementation the player should select on this browser: prefixed
 * (WebKit, then MS) first only when preferPrefixedMediaKeys is true, otherwise
 * standard first; either way falling back to whatever is available.
 */
function expectedImplementation(
    preferPrefixedMediaKeys: Maybe<boolean>
): EmeImplementation | null {
    const order: readonly EmeImplementation[] =
        preferPrefixedMediaKeys === true
            ? ['webkit', 'ms', 'standard']
            : ['standard', 'webkit', 'ms']
    const support = browserEmeSupport()
    return order.find((implementation) => support.has(implementation)) ?? null
}

/**
 * Spies on each browser EME entry point (calling through to the real API) and
 * returns the implementations the player used for a key system support check.
 */
async function usedImplementations(
    player: VinylPlayer
): Promise<readonly EmeImplementation[]> {
    const spies: [EmeImplementation, jasmine.Spy][] = []
    if (typeof navigator.requestMediaKeySystemAccess === 'function') {
        spies.push([
            'standard',
            spyOn(navigator, 'requestMediaKeySystemAccess').and.callThrough(),
        ])
    }
    if (typeof WebKitMediaKeys !== 'undefined') {
        spies.push([
            'webkit',
            spyOn(WebKitMediaKeys, 'isTypeSupported').and.callThrough(),
        ])
    }
    const msMediaKeys = (globalThis as any).MSMediaKeys
    if (typeof msMediaKeys !== 'undefined') {
        spies.push([
            'ms',
            spyOn(msMediaKeys, 'isTypeSupported').and.callThrough(),
        ])
    }

    await player.client.capabilities.supportsKeySystem(DrmKeySystem.WIDEVINE)
    return spies
        .filter(([, spy]) => spy.calls.any())
        .map(([implementation]) => implementation)
}

describe('drm.preferPrefixedMediaKeys integ', () => {
    for (const preferPrefixedMediaKeys of [undefined, false, true]) {
        describe(`when ${String(preferPrefixedMediaKeys)}`, () => {
            const vinylSuite = createVinylSuite({
                drm: {
                    keySystems: {},
                    ...(preferPrefixedMediaKeys !== undefined && {
                        preferPrefixedMediaKeys,
                    }),
                },
            })

            it('uses the preferred EME implementation the browser supports', async () => {
                const expected = expectedImplementation(preferPrefixedMediaKeys)
                if (expected == null) pending('requires EME')
                expect(await usedImplementations(vinylSuite.player)).toEqual([
                    expected!,
                ])
            })
        })
    }
})
