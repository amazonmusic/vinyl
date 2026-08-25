/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { pickPreferredTextTrack, type TextTrackInfo } from '@amazon/vinyl'

let nextId = 0
function track(overrides: Partial<TextTrackInfo> = {}): TextTrackInfo {
    return {
        id: `t${nextId++}`,
        kind: 'subtitles',
        language: 'en',
        label: '',
        default: false,
        forced: false,
        characteristics: [],
        uri: 'x.vtt',
        mimeType: null,
        ...overrides,
    }
}

describe('pickPreferredTextTrack', () => {
    it('returns null when the preference is null (captions off)', () => {
        expect(pickPreferredTextTrack([track()], null)).toBeNull()
    })

    it('returns null when there are no tracks', () => {
        expect(pickPreferredTextTrack([], 'en')).toBeNull()
    })

    it('selects the track matching the preferred language', () => {
        const en = track({ id: 'en', language: 'en' })
        const es = track({ id: 'es', language: 'es' })
        expect(pickPreferredTextTrack([es, en], 'en')).toBe(en)
    })

    it('returns null when no track relates to the preference', () => {
        expect(
            pickPreferredTextTrack([track({ language: 'es' })], 'ja')
        ).toBeNull()
    })

    it('ignores tracks without a language tag', () => {
        expect(
            pickPreferredTextTrack([track({ language: null })], 'en')
        ).toBeNull()
    })

    it('prefers a full track over a forced-only track of the same language', () => {
        const forced = track({ id: 'forced', language: 'en', forced: true })
        const full = track({ id: 'full', language: 'en', forced: false })
        expect(pickPreferredTextTrack([forced, full], 'en')).toBe(full)
    })

    it('breaks a remaining tie by the manifest-default flag', () => {
        const a = track({ id: 'a', language: 'en', default: false })
        const b = track({ id: 'b', language: 'en', default: true })
        expect(pickPreferredTextTrack([a, b], 'en')).toBe(b)
    })

    it('honors preference order, earlier entries winning', () => {
        const en = track({ id: 'en', language: 'en' })
        const fr = track({ id: 'fr', language: 'fr' })
        expect(pickPreferredTextTrack([en, fr], ['fr', 'en'])).toBe(fr)
        expect(pickPreferredTextTrack([en, fr], ['en', 'fr'])).toBe(en)
    })

    it('matches a related language when no exact match exists', () => {
        const enUs = track({ id: 'en-US', language: 'en-US' })
        const es = track({ id: 'es', language: 'es' })
        // 'en' is the parent of 'en-US' — related, so it should be chosen.
        expect(pickPreferredTextTrack([es, enUs], 'en')).toBe(enUs)
    })

    it('prefers a closer language match over a more distant one', () => {
        const enUs = track({ id: 'en-US', language: 'en-US' })
        const enGb = track({ id: 'en-GB', language: 'en-GB' })
        // Exact 'en-US' (relatedness 4) beats sibling 'en-GB' (relatedness 2).
        expect(pickPreferredTextTrack([enGb, enUs], 'en-US')).toBe(enUs)
    })
})
