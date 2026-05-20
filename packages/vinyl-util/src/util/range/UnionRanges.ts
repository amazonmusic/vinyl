/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Range,
    RangesImpl,
    type ReadonlyRanges,
    ReadonlyRangesImpl,
} from './Ranges'
import type { Maybe } from '@/util/type'

export interface UnionRangesOptions {
    /**
     * If true, only recomputes ranges after a call to `invalidate`.
     * After `invalidate()`, the ranges are recalculated on next read.
     * Default: false
     */
    readonly useCache?: boolean
}

/**
 * Takes a list of ranges and computes the union ranges on read.
 */
export class UnionRanges extends ReadonlyRangesImpl {
    private readonly backingRanges = new RangesImpl()
    private valid = false
    private _innerRanges: readonly ReadonlyRanges[]

    constructor(
        /**
         * The ranges for which to compute the union.
         */
        innerRanges: readonly ReadonlyRanges[],

        private readonly options?: Maybe<UnionRangesOptions>
    ) {
        super()
        this._innerRanges = innerRanges
    }

    get innerRanges(): readonly ReadonlyRanges[] {
        return this._innerRanges
    }

    set innerRanges(value: readonly ReadonlyRanges[]) {
        this._innerRanges = value
        this.invalidate()
    }

    get ranges(): readonly Range[] {
        if (!this.valid) this.validate()
        return this.backingRanges.ranges
    }

    /**
     * Flags the union ranges as invalid.
     * This has no effect if options.useCache is not true.
     */
    invalidate() {
        this.valid = false
    }

    /**
     * Refreshes the backing ranges.
     */
    private validate() {
        this.backingRanges.clear()
        for (const ranges of this._innerRanges) {
            for (const [start, end] of ranges) {
                this.backingRanges.add(start, end)
            }
        }
        if (this.options?.useCache === true) {
            this.valid = true
        }
    }
}
