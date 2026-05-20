/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getLocationSearch, getSearchParams, isNode } from '@amazon/vinyl-util'

describe('searchParams', () => {
    afterEach(() => {
        // In our tests we modify the window search. In a browser window search cannot change
        // without a page reload, only the location hash.
        getSearchParams.clear()
    })

    it('provides search params for the provided search', () => {
        expect(getSearchParams('?alpha=beta').get('alpha')).toBe('beta')
        expect(getSearchParams('?gamma=delta').get('gamma')).toBe('delta')
    })

    it('memoizes the result', () => {
        {
            const p1 = getSearchParams('?gamma=delta')
            const p2 = getSearchParams('?gamma=delta')
            expect(p1).toBe(p2)
        }
        {
            const p1 = getSearchParams()
            const p2 = getSearchParams()
            expect(p1).toBe(p2)
        }
    })

    describe('when search argument is not provided', () => {
        it('uses getLocationSearch()', () => {
            if (!isNode()) return pending('cannot change window.location')
            const prev = global.location
            global.location = {
                search: '?alpha=beta',
            } as Location
            const sP = getSearchParams()
            expect(sP.get('alpha')).toBe('beta')
            global.location = prev
        })
    })
})

describe('getLocationSearch()', () => {
    describe('when location is defined', () => {
        beforeEach(() => {
            if (isNode()) {
                ;(global as any).location = {
                    search: 'search',
                }
            }
        })

        afterEach(() => {
            if (isNode()) {
                delete (global as any).location
            }
        })

        it('returns the location search', () => {
            expect(getLocationSearch()).toBe(location.search)
        })
    })

    describe('when location is not defined', () => {
        const location = global.location
        beforeEach(() => {
            if (isNode()) {
                global.location = undefined as any
            } else {
                pending('Cannot remove window.location')
            }
        })

        afterEach(() => {
            if (isNode()) global.location = location
        })

        it('returns an empty string', () => {
            expect(getLocationSearch()).toBe('')
        })
    })
})
