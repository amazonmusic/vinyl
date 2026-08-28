/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapeHtml } from './html'
import {
    absoluteUrl,
    GITHUB_URL,
    type NavItem,
    OG_IMAGE,
    SITE_NAME,
    withBase,
} from './siteConfig'

// Inline SVGs for the persistent chrome (mirrors packages/.../components/icons).
const ICONS = {
    dashboard:
        '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Z"/></svg>',
    play_circle:
        '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>',
    description:
        '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T740-80H240Zm280-520v-200H240v640h500v-440H520Z"/></svg>',
    code: '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z"/></svg>',
    github: '<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
    menu: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>',
    dark_mode:
        '<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/></svg>',
} as const

export const NAV_ITEMS: readonly NavItem[] = [
    { key: 'overview', label: 'Overview', href: '/', icon: ICONS.dashboard },
    {
        key: 'player',
        label: 'Player',
        href: '/player/',
        icon: ICONS.play_circle,
    },
    {
        key: 'docs',
        label: 'Documentation',
        href: '/docs/',
        icon: ICONS.description,
    },
    {
        key: 'api',
        label: 'API Docs',
        href: '/tsdocs/index.html',
        icon: ICONS.code,
        external: true,
    },
    {
        key: 'github',
        label: 'GitHub',
        href: GITHUB_URL,
        icon: ICONS.github,
        external: true,
    },
]

export interface PageMeta {
    /** Root-relative path, e.g. `/docs/vinyl-usage/`. */
    readonly path: string
    readonly title: string
    readonly description: string
    readonly keywords?: string
    /** Open Graph type; defaults to `website`. */
    readonly ogType?: string
    /** Canonical path override (defaults to {@link path}); use when a page
     * duplicates another's content. */
    readonly canonicalPath?: string
    /** Structured data emitted as JSON-LD. */
    readonly jsonLd?: object | readonly object[]
}

/** Renders the per-page `<head>` SEO block that fills the `ssg:head` marker. */
export function renderHeadMeta(meta: PageMeta): string {
    const canonical = absoluteUrl(meta.canonicalPath ?? meta.path)
    const image = absoluteUrl(OG_IMAGE)
    const jsonLd = meta.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(
              meta.jsonLd
          ).replace(/</g, '\\u003c')}</script>`
        : ''
    return [
        `<title>${escapeHtml(meta.title)}</title>`,
        `<meta name="description" content="${escapeHtml(meta.description)}" />`,
        meta.keywords
            ? `<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`
            : '',
        `<meta name="author" content="Amazon" />`,
        `<meta name="robots" content="index, follow" />`,
        `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
        `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
        `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
        `<meta property="og:type" content="${meta.ogType ?? 'website'}" />`,
        `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
        `<meta property="og:image" content="${escapeHtml(image)}" />`,
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
        jsonLd,
    ]
        .filter(Boolean)
        .join('\n        ')
}

function navMarkup(activeNav: string): string {
    return NAV_ITEMS.map((item) => {
        const active = item.key === activeNav ? ' active' : ''
        const rel = item.external ? ' target="_blank" rel="noopener"' : ''
        const current = item.key === activeNav ? ' aria-current="page"' : ''
        const href = item.href.startsWith('/') ? withBase(item.href) : item.href
        return `<a class="navItem${active}" role="menuitem" href="${href}"${rel}${current}><span class="iconContainer" aria-hidden="true">${item.icon}</span>${item.label}</a>`
    }).join('\n            ')
}

/**
 * Renders the persistent chrome (mobile header, sidebar, theme switch) plus the
 * `<main>` content region — the body that fills the `ssg:body` marker.
 */
export function renderBody(options: {
    readonly activeNav: string
    readonly content: string
    readonly version: string
}): string {
    const { activeNav, content, version } = options
    // The layout CSS lays out `#app` as a grid (sidebar column + content column),
    // so the chrome and main content must live inside that container.
    return `<div id="app">
<header class="mobileHeader">
    <button class="menuBtn" aria-label="Open menu"><span class="iconContainer" aria-hidden="true">${ICONS.menu}</span></button>
    <img src="${withBase('/img/logo-64.png')}" alt="Amazon Vinyl logo" width="32" height="32" />
    <span class="mobileTitle">Amazon Vinyl <span class="versionTag">v${escapeHtml(version)}</span></span>
    <a class="mobileGithub" href="${GITHUB_URL}" target="_blank" rel="noopener" aria-label="Amazon Vinyl on GitHub"><span class="iconContainer" aria-hidden="true">${ICONS.github}</span></a>
</header>
<div class="sidebarOverlay"></div>
<aside class="sidebar">
    <a class="logo" href="${withBase('/')}">
        <img src="${withBase('/img/logo-64.png')}" alt="Amazon Vinyl logo" width="40" height="40" />
        <span class="logoText"><span>Amazon Vinyl</span><span class="versionTag">v${escapeHtml(version)}</span></span>
    </a>
    <nav role="menu" aria-label="Main navigation">
            ${navMarkup(activeNav)}
    </nav>
    <div class="themeToggle" hidden>
        <div class="themeSwitch" role="switch" tabindex="0" aria-checked="false" aria-label="Dark mode">
            <span class="iconContainer" aria-hidden="true">${ICONS.dark_mode}</span>
            <span>Dark mode</span>
            <div class="switchTrack"><div class="switchThumb"></div></div>
        </div>
    </div>
</aside>
<main class="stage">
${content}
</main>
</div>`
}
