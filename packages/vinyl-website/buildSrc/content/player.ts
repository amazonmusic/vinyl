/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PageMeta } from '../pageTemplate'
import { absoluteUrl, SITE_NAME } from '../siteConfig'

export const playerMeta: PageMeta = {
    path: '/player/',
    title: 'Player Demo — Amazon Vinyl DASH & HLS Streaming',
    description:
        'Try Amazon Vinyl in the browser: play DASH and HLS demo streams, load your own manifest URL, and exercise HLS Interstitial (SGAI) ad breaks.',
    keywords:
        'Amazon Vinyl demo, DASH player, HLS player, streaming demo, HLS interstitials, SGAI ad breaks, adaptive bitrate',
    jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: `${SITE_NAME} Player Demo`,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        url: absoluteUrl('/player/'),
        browserRequirements: 'Requires Media Source Extensions (MSE).',
        description:
            'Interactive demo of the Amazon Vinyl HTML5 streaming engine for DASH and HLS.',
    },
}

export function playerContent(): string {
    return `<div class="page">
    <div class="pageHeader">
        <h1>Player Demo</h1>
        <div class="subtitle">Load DASH or HLS content by URL, or play a demo stream — right in your browser.</div>
    </div>

    <section class="card">
        <p>
            This interactive demo runs the Amazon Vinyl playback engine directly in your
            browser. Paste any MPEG-DASH (<code>.mpd</code>) or HLS (<code>.m3u8</code>) manifest
            URL to play it, or pick one of the bundled demo streams below — including audio-only and
            video DASH, HLS with fragmented MP4 and MPEG-TS transmuxing, and HLS Interstitial (SGAI)
            ad-break scenarios such as pre/mid/post rolls, asset lists, and playout limits.
        </p>
    </section>
</div>
<noscript>
    <div class="page">
        <section class="card">
            <p>The interactive player demo requires JavaScript. Please enable JavaScript to load and play streams.</p>
        </section>
    </div>
</noscript>
<div id="player-root"></div>`
}
