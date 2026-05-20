/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { compareBy, max, MediaUnsupportedError } from '@amazon/vinyl-util'

export function throwLanguagesUnsupported(): never {
    throw new MediaUnsupportedError(
        'No content matching preferred language',
        'language'
    )
}

/**
 * Map from ISO 639-2 (3-letter) to ISO 639-1 (2-letter) codes.
 * Covers the most common languages encountered in streaming media.
 */
const iso3to2 = new Map<string, string>([
    ['aar', 'aa'],
    ['abk', 'ab'],
    ['afr', 'af'],
    ['aka', 'ak'],
    ['amh', 'am'],
    ['ara', 'ar'],
    ['arg', 'an'],
    ['asm', 'as'],
    ['ava', 'av'],
    ['ave', 'ae'],
    ['aym', 'ay'],
    ['aze', 'az'],
    ['bak', 'ba'],
    ['bam', 'bm'],
    ['bel', 'be'],
    ['ben', 'bn'],
    ['bis', 'bi'],
    ['bod', 'bo'],
    ['bos', 'bs'],
    ['bre', 'br'],
    ['bul', 'bg'],
    ['cat', 'ca'],
    ['ces', 'cs'],
    ['cha', 'ch'],
    ['che', 'ce'],
    ['chu', 'cu'],
    ['chv', 'cv'],
    ['cor', 'kw'],
    ['cos', 'co'],
    ['cre', 'cr'],
    ['cym', 'cy'],
    ['dan', 'da'],
    ['deu', 'de'],
    ['div', 'dv'],
    ['dzo', 'dz'],
    ['ell', 'el'],
    ['eng', 'en'],
    ['epo', 'eo'],
    ['est', 'et'],
    ['eus', 'eu'],
    ['ewe', 'ee'],
    ['fao', 'fo'],
    ['fas', 'fa'],
    ['fij', 'fj'],
    ['fin', 'fi'],
    ['fra', 'fr'],
    ['fry', 'fy'],
    ['ful', 'ff'],
    ['gla', 'gd'],
    ['gle', 'ga'],
    ['glg', 'gl'],
    ['glv', 'gv'],
    ['grn', 'gn'],
    ['guj', 'gu'],
    ['hat', 'ht'],
    ['hau', 'ha'],
    ['heb', 'he'],
    ['her', 'hz'],
    ['hin', 'hi'],
    ['hmo', 'ho'],
    ['hrv', 'hr'],
    ['hun', 'hu'],
    ['hye', 'hy'],
    ['ibo', 'ig'],
    ['ido', 'io'],
    ['iii', 'ii'],
    ['iku', 'iu'],
    ['ile', 'ie'],
    ['ina', 'ia'],
    ['ind', 'id'],
    ['ipk', 'ik'],
    ['isl', 'is'],
    ['ita', 'it'],
    ['jav', 'jv'],
    ['jpn', 'ja'],
    ['kal', 'kl'],
    ['kan', 'kn'],
    ['kas', 'ks'],
    ['kat', 'ka'],
    ['kau', 'kr'],
    ['kaz', 'kk'],
    ['khm', 'km'],
    ['kik', 'ki'],
    ['kin', 'rw'],
    ['kir', 'ky'],
    ['kom', 'kv'],
    ['kon', 'kg'],
    ['kor', 'ko'],
    ['kua', 'kj'],
    ['kur', 'ku'],
    ['lao', 'lo'],
    ['lat', 'la'],
    ['lav', 'lv'],
    ['lim', 'li'],
    ['lin', 'ln'],
    ['lit', 'lt'],
    ['ltz', 'lb'],
    ['lub', 'lu'],
    ['lug', 'lg'],
    ['mah', 'mh'],
    ['mal', 'ml'],
    ['mar', 'mr'],
    ['mkd', 'mk'],
    ['mlg', 'mg'],
    ['mlt', 'mt'],
    ['mon', 'mn'],
    ['mri', 'mi'],
    ['msa', 'ms'],
    ['mya', 'my'],
    ['nau', 'na'],
    ['nav', 'nv'],
    ['nbl', 'nr'],
    ['nde', 'nd'],
    ['ndo', 'ng'],
    ['nep', 'ne'],
    ['nld', 'nl'],
    ['nno', 'nn'],
    ['nob', 'nb'],
    ['nor', 'no'],
    ['nya', 'ny'],
    ['oci', 'oc'],
    ['oji', 'oj'],
    ['ori', 'or'],
    ['orm', 'om'],
    ['oss', 'os'],
    ['pan', 'pa'],
    ['pli', 'pi'],
    ['pol', 'pl'],
    ['por', 'pt'],
    ['pus', 'ps'],
    ['que', 'qu'],
    ['roh', 'rm'],
    ['ron', 'ro'],
    ['run', 'rn'],
    ['rus', 'ru'],
    ['sag', 'sg'],
    ['san', 'sa'],
    ['sin', 'si'],
    ['slk', 'sk'],
    ['slv', 'sl'],
    ['sme', 'se'],
    ['smo', 'sm'],
    ['sna', 'sn'],
    ['snd', 'sd'],
    ['som', 'so'],
    ['sot', 'st'],
    ['spa', 'es'],
    ['sqi', 'sq'],
    ['srd', 'sc'],
    ['srp', 'sr'],
    ['ssw', 'ss'],
    ['sun', 'su'],
    ['swa', 'sw'],
    ['swe', 'sv'],
    ['tah', 'ty'],
    ['tam', 'ta'],
    ['tat', 'tt'],
    ['tel', 'te'],
    ['tgk', 'tg'],
    ['tgl', 'tl'],
    ['tha', 'th'],
    ['tir', 'ti'],
    ['ton', 'to'],
    ['tsn', 'tn'],
    ['tso', 'ts'],
    ['tuk', 'tk'],
    ['tur', 'tr'],
    ['twi', 'tw'],
    ['uig', 'ug'],
    ['ukr', 'uk'],
    ['urd', 'ur'],
    ['uzb', 'uz'],
    ['ven', 've'],
    ['vie', 'vi'],
    ['vol', 'vo'],
    ['wln', 'wa'],
    ['wol', 'wo'],
    ['xho', 'xh'],
    ['yid', 'yi'],
    ['yor', 'yo'],
    ['zha', 'za'],
    ['zho', 'zh'],
    ['zul', 'zu'],
    // Bibliographic codes (ISO 639-2/B) that differ from terminological codes
    ['alb', 'sq'],
    ['arm', 'hy'],
    ['baq', 'eu'],
    ['bur', 'my'],
    ['chi', 'zh'],
    ['cze', 'cs'],
    ['dut', 'nl'],
    ['fre', 'fr'],
    ['geo', 'ka'],
    ['ger', 'de'],
    ['gre', 'el'],
    ['ice', 'is'],
    ['mac', 'mk'],
    ['mao', 'mi'],
    ['may', 'ms'],
    ['per', 'fa'],
    ['rum', 'ro'],
    ['slo', 'sk'],
    ['tib', 'bo'],
    ['wel', 'cy'],
])

/**
 * Normalizes a BCP 47 / RFC 5646 language tag.
 *
 * - Converts ISO 639-2 (3-letter) codes to ISO 639-1 (2-letter)
 * - Forces language to lowercase, region to uppercase
 * - Discards script/dialect subtags beyond language-REGION
 *
 * Examples: `eng` → `en`, `en-us` → `en-US`, `fra-CA` → `fr-CA`
 */
export function normalizeLanguage(locale: string): string {
    const parts = locale.split('-')
    let language = (parts[0] || '').toLowerCase()
    language = iso3to2.get(language) || language
    const region = parts[1] ? parts[1].toUpperCase() : ''
    return region ? `${language}-${region}` : language
}

/**
 * Computes a relatedness score between two language codes.
 * Higher is better. 0 means unrelated.
 *
 * - 4: exact match after normalization (e.g. `en-US` vs `en-US`)
 * - 3: candidate is parent of target (e.g. `en` vs `en-US`)
 * - 2: candidate is sibling of target (e.g. `en-CA` vs `en-US`)
 * - 1: candidate is child of target (e.g. `en-US` vs `en`)
 * - 0: unrelated
 */
export function languageRelatedness(target: string, candidate: string): number {
    const t = normalizeLanguage(target)
    const c = normalizeLanguage(candidate)

    if (c === t) return 4

    const tParts = t.split('-')
    const cParts = c.split('-')

    if (tParts[0] !== cParts[0]) return 0

    // candidate is parent of target: candidate has no region, target does
    if (cParts.length === 1 && tParts.length === 2) return 3

    // candidate is sibling: both have regions (different, since exact match already checked)
    if (cParts.length === 2 && tParts.length === 2) return 2

    // candidate is child of target: target has no region, candidate does
    return 1 // tParts.length === 1 && cParts.length === 2
}

/**
 * Finds the best language match from a set of available languages.
 * Returns the best matching language, or undefined if the set is empty.
 * When no language is related, the first available language is returned.
 */
export function findBestLanguageMatch(
    target: string,
    available: ArrayLike<string>
): string | undefined {
    return max(
        available,
        compareBy((lang) => languageRelatedness(target, lang))
    )
}
