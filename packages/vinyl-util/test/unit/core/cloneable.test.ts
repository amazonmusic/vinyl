/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Cloneable, isCloneable } from '@amazon/vinyl-util'
import { expectTypeExtends } from '@amazon/vinyl-util/browserTestUtil'

describe('isCloneable', () => {
    it('returns true if an object has a clone method', () => {
        expect(isCloneable(null)).toBeFalse()
        expect(isCloneable(undefined)).toBeFalse()
        expect(isCloneable(3)).toBeFalse()
        expect(
            isCloneable({
                clone() {},
            })
        ).toBeTrue()

        expect(
            isCloneable({
                clone: 3,
            })
        ).toBeFalse()

        expect(
            isCloneable({
                // Must be 0 parameters
                clone(_: number) {},
            })
        ).toBeFalse()
    })

    it('narrows the value type', () => {
        interface WithValue {
            readonly value: number
        }
        class CloneImpl implements Cloneable<CloneImpl>, WithValue {
            constructor(readonly value: number) {}
            clone(): CloneImpl {
                return new CloneImpl(this.value)
            }
        }
        const v: WithValue = new CloneImpl(3)
        if (isCloneable(v)) {
            expectTypeExtends<typeof v, Cloneable<WithValue>>(true)
        } else {
            expectTypeExtends<typeof v, Cloneable<WithValue>>(false)
        }
    })
})
