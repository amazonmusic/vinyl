/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Range, type ReadonlyRanges, ReadonlyRangesImpl } from './Ranges'
import type { Maybe } from '@/util/type'

export interface IntersectionRangesOptions {
    /**
     * If true, only recomputes ranges after a call to `invalidate`.
     * After `invalidate()`, the ranges are recalculated on next read.
     * Default: false
     */
    readonly useCache?: boolean
}

/**
 * Takes a list of ranges and computes the intersection ranges on read.
 */
export class IntersectionRanges extends ReadonlyRangesImpl {
    private backingRanges: ArrayLike<Range> = []
    private valid = false
    private _innerRanges: readonly ReadonlyRanges[]

    constructor(
        /**
         * The ranges for which to compute the intersection.
         */
        innerRanges: readonly ReadonlyRanges[],

        private readonly options?: Maybe<IntersectionRangesOptions>
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

    get ranges(): ArrayLike<Range> {
        if (!this.valid) this.validate()
        return this.backingRanges
    }

    /**
     * Flags the intersection ranges as invalid.
     * This has no effect if options.useCache is not true.
     */
    invalidate() {
        this.valid = false
    }

    /**
     * Refreshes the backing ranges by computing intersection.
     */
    private validate() {
        if (this._innerRanges.length === 0) {
            this.backingRanges = []
            if (this.options?.useCache === true) {
                this.valid = true
            }
            return
        }

        // Start with the first range set
        this.backingRanges = this._innerRanges[0].ranges

        // Intersect with each subsequent range set
        for (let i = 1; i < this._innerRanges.length; i++) {
            const currentRanges = this._innerRanges[i]
            const tempRanges: Range[] = []

            // Find intersections between backingRanges and currentRanges
            for (let j = 0; j < this.backingRanges.length; j++) {
                const [backStart, backEnd] = this.backingRanges[j]
                for (const [currStart, currEnd] of currentRanges) {
                    const intersectionStart = Math.max(backStart, currStart)
                    const intersectionEnd = Math.min(backEnd, currEnd)

                    if (intersectionStart < intersectionEnd) {
                        tempRanges.push([intersectionStart, intersectionEnd])
                    }
                }
            }

            // Replace backing ranges with intersection result
            this.backingRanges = tempRanges
        }

        if (this.options?.useCache === true) {
            this.valid = true
        }
    }
}
