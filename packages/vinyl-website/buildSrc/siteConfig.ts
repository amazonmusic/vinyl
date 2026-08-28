/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Absolute origin the static site is served from, without trailing slash. Used
// for canonical URLs, Open Graph tags, and the sitemap. Set via the SITE_URL env
// var for the real deploy.
export const SITE_URL = process.env.SITE_URL ?? 'https://amazonmusic.github.io'

// Sub-path the site is served under, with leading and trailing slash. Defaults
// to the GitHub Pages project path (`/vinyl/`, so the home page is
// https://amazonmusic.github.io/vinyl/); override with the BASE_PATH env var
// (e.g. `/` for root hosting). Also passed to Vite's `base`, so hashed assets
// get the same prefix.
export const BASE_PATH = normalizeBase(process.env.BASE_PATH ?? '/vinyl/')

function normalizeBase(base: string): string {
    let b = base.startsWith('/') ? base : '/' + base
    if (!b.endsWith('/')) b += '/'
    return b
}

export const SITE_NAME = 'Amazon Vinyl'
export const GITHUB_URL = 'https://github.com/amazonmusic/vinyl'
export const OG_IMAGE = '/img/logo-256.png'

/** Prefixes a root-relative path (e.g. `/docs/x/`) with {@link BASE_PATH}. */
export function withBase(path: string): string {
    return BASE_PATH.replace(/\/$/, '') + path
}

/** Joins a root-relative path onto the origin + base to form an absolute URL. */
export function absoluteUrl(path: string): string {
    return SITE_URL + withBase(path)
}

export interface NavItem {
    /** Stable key used to mark the active item per page. */
    readonly key: string
    readonly label: string
    readonly href: string
    /** Inline SVG markup (see icon set in `pageTemplate`). */
    readonly icon: string
    readonly external?: boolean
}
