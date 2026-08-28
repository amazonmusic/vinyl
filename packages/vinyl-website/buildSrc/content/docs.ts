/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildDocs, type DocInfo } from '../docsPlugin'
import { escapeHtml } from '../html'
import type { PageMeta } from '../pageTemplate'
import { absoluteUrl, SITE_NAME, SITE_URL, withBase } from '../siteConfig'

export interface DocPage {
    readonly meta: PageMeta
    readonly content: string
    /** Nav key for chrome highlighting. */
    readonly activeNav: string
}

/** Ordered, de-duplicated list of doc categories. */
function categoriesOf(docs: readonly DocInfo[]): string[] {
    return [...new Set(docs.map((d) => d.category))]
}

/** The per-doc side navigation, with `activeSlug` marked current. */
function docsMenu(docs: readonly DocInfo[], activeSlug: string): string {
    const groups = categoriesOf(docs).map((cat) => {
        const items = docs
            .filter((d) => d.category === cat)
            .map((d) => {
                const active = d.slug === activeSlug
                return `<a class="docsMenuItem${active ? ' active' : ''}" role="menuitem" href="${withBase(`/docs/${d.slug}/`)}"${
                    active ? ' aria-current="page"' : ''
                }>${escapeHtml(d.title)}</a>`
            })
            .join('\n            ')
        return `<div class="docsCategoryHeader" role="presentation">${escapeHtml(cat)}</div>\n            ${items}`
    })
    return `<nav class="docsMenu" role="menu" aria-label="Documentation">
            ${groups.join('\n            ')}
        </nav>`
}

/** The side-nav + rendered article layout for a single doc. */
function docLayout(docs: readonly DocInfo[], doc: DocInfo): string {
    return `<div class="docsLayout">
        ${docsMenu(docs, doc.slug)}
        <article class="docsContent markdown">${doc.html}</article>
    </div>`
}

function docJsonLd(doc: DocInfo): readonly object[] {
    const url = absoluteUrl(`/docs/${doc.slug}/`)
    return [
        {
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: doc.title,
            description: doc.description,
            url,
            author: { '@type': 'Organization', name: 'Amazon' },
            isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: absoluteUrl('/'),
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Documentation',
                    item: absoluteUrl('/docs/'),
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: doc.title,
                    item: url,
                },
            ],
        },
    ]
}

/**
 * Builds every docs route: `/docs/` renders the first document (its canonical
 * points at that document's own page to avoid duplicate content), and each
 * document gets its own `/docs/<slug>/` page.
 */
export function docsPages(root: string): DocPage[] {
    const docs = buildDocs(root)
    if (docs.length === 0) return []
    const pages: DocPage[] = []

    const first = docs[0]
    pages.push({
        activeNav: 'docs',
        content: docLayout(docs, first),
        meta: {
            path: '/docs/',
            title: 'Documentation — Amazon Vinyl',
            description:
                'Guides and API references for Amazon Vinyl: usage, HLS and DASH streaming, DRM, ad breaks, text tracks, and more.',
            keywords:
                'Amazon Vinyl docs, documentation, streaming guide, API reference',
            canonicalPath: `/docs/${first.slug}/`,
        },
    })

    for (const doc of docs) {
        pages.push({
            activeNav: 'docs',
            content: docLayout(docs, doc),
            meta: {
                path: `/docs/${doc.slug}/`,
                title: `${doc.title} — Amazon Vinyl`,
                description: doc.description,
                ogType: 'article',
                jsonLd: docJsonLd(doc),
            },
        })
    }
    return pages
}
