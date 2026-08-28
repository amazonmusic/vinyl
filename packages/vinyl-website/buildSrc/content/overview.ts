/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import hljs from 'highlight.js'
import type { PageMeta } from '../pageTemplate'
import { absoluteUrl, GITHUB_URL, SITE_NAME, withBase } from '../siteConfig'

const CHECK =
    '<svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="var(--color-success)"><path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>'

function ts(code: string): string {
    return hljs.highlight(code, { language: 'typescript' }).value
}
function shell(code: string): string {
    return hljs.highlight(code, { language: 'shell' }).value
}

const FEATURES: readonly (readonly [string, string])[] = [
    [
        'DASH & HLS adaptive streaming',
        'Play MPEG-DASH and HLS sources with automatic quality adaptation.',
    ],
    [
        'Widevine, FairPlay & PlayReady DRM',
        'Protected playback across every major content-protection system.',
    ],
    [
        'Adaptive bitrate selection',
        'Bandwidth- and buffer-aware ABR that keeps playback smooth.',
    ],
    [
        'Gapless track transitions',
        'Seamless, gapless switching between queued tracks.',
    ],
    [
        'UHD audio up to 192 kHz',
        'High-resolution audio playback at studio sample rates.',
    ],
    [
        'Zero runtime dependencies',
        'A self-contained engine — nothing else to ship.',
    ],
    ['Full TypeScript support', 'First-class types for the entire public API.'],
]

const COMPAT: readonly (readonly [string, string])[] = [
    ['Chrome', 'v52+'],
    ['Firefox', 'v52+'],
    ['Safari', 'HLS v11+, DASH v17+'],
    ['Edge', 'v18+'],
    ['Chromium', 'v52+'],
]

const STATS: readonly (readonly [string, string])[] = [
    ['90 kB', 'Size (Gzipped)'],
    ['100%', 'Test Coverage'],
    ['0', 'Dependencies'],
    ['99.9%', 'Browser Support'],
]

const BASIC_USAGE = `import { createVinylPlayer } from '@amazon/vinyl'

const media = document.createElement('video')
media.width = 640
media.height = 360
media.controls = true
document.body.appendChild(media)

const player = createVinylPlayer({ media })
player.load({
    type: 'dash',
    uri: 'https://example.com/manifest.mpd',
})`

export const overviewMeta: PageMeta = {
    path: '/',
    title: 'Amazon Vinyl — HTML5 DASH & HLS Streaming Player Engine',
    description:
        'Amazon Vinyl is a high-performance, dependency-free HTML5 playback engine for DASH and HLS streaming with Widevine, FairPlay, and PlayReady DRM.',
    keywords:
        'Amazon Vinyl, HTML5 player, streaming, DASH, HLS, DRM, Widevine, FairPlay, PlayReady, adaptive bitrate, MSE, EME, TypeScript',
    jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        description:
            'A high-performance, dependency-free HTML5 playback engine for DASH and HLS streaming with Widevine, FairPlay, and PlayReady DRM.',
        url: absoluteUrl('/'),
        codeRepository: GITHUB_URL,
        programmingLanguage: 'TypeScript',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Organization', name: 'Amazon' },
    },
}

export function overviewContent(): string {
    const stats = STATS.map(
        ([value, label]) =>
            `<div class="statCard"><div class="statValue">${value}</div><div class="statLabel">${label}</div></div>`
    ).join('')

    const features = FEATURES.map(
        ([title, desc]) =>
            `<div class="featureItem"><span class="iconContainer" aria-hidden="true">${CHECK}</span><span><strong>${title}</strong> — ${desc}</span></div>`
    ).join('')

    const compat = COMPAT.map(
        ([browser, support]) =>
            `<tr><td>${browser}</td><td><span class="badge">${support}</span></td></tr>`
    ).join('')

    return `<div class="page">
    <section class="heroSection">
        <img src="${withBase('/img/logo-256.png')}" alt="Amazon Vinyl logo" class="heroLogo" width="128" height="128" />
        <div class="heroText">
            <h1 class="heroTitle">Amazon Vinyl</h1>
            <p class="heroSubtitle">A high-performance HTML5 streaming engine for DASH and HLS — with DRM, adaptive bitrate, and zero runtime dependencies.</p>
        </div>
    </section>

    <section class="statsGrid" aria-label="Key metrics">${stats}</section>

    <section class="card">
        <div class="cardHeader"><h2>Features</h2></div>
        <div class="featureList">${features}</div>
    </section>

    <section class="card">
        <div class="cardHeader"><h2>Browser compatibility</h2></div>
        <table class="compatTable">
            <thead><tr><th>Browser</th><th>Support</th></tr></thead>
            <tbody>${compat}</tbody>
        </table>
    </section>

    <section class="card">
        <div class="cardHeader"><h2>Getting started</h2></div>
        <div class="markdown">
            <h3>Installation</h3>
            <div class="pmTabs">
                <div class="tabs" role="group" aria-label="Package manager">
                    <button class="tab active" type="button" aria-pressed="true" data-pm="npm">npm</button>
                    <button class="tab" type="button" aria-pressed="false" data-pm="yarn">yarn</button>
                </div>
                <pre tabindex="0"><code class="hljs language-shell" data-pm-code="npm">${shell('npm install @amazon/vinyl')}</code><code class="hljs language-shell" data-pm-code="yarn" hidden>${shell('yarn add @amazon/vinyl')}</code></pre>
            </div>

            <h3>Basic usage</h3>
            <pre tabindex="0"><code class="hljs language-typescript">${ts(BASIC_USAGE)}</code></pre>
            <p><a href="https://codepen.io/editor/indiepig/pen/01a0492d-ed52-7898-b7db-5f89a6a0bf55" target="_blank" rel="noopener">Edit on CodePen</a></p>
            <p>See the <a href="${withBase('/docs/vinyl-usage/')}">full usage guide</a> for HLS, DRM, preloading, queueing, and advanced configuration, or try the <a href="${withBase('/player/')}">interactive player demo</a>.</p>
        </div>
    </section>
</div>`
}
