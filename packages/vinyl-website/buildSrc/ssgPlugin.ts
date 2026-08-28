/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Plugin } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { overviewContent, overviewMeta } from './content/overview'
import { playerContent, playerMeta } from './content/player'
import { docsPages } from './content/docs'
import { type PageMeta, renderBody, renderHeadMeta } from './pageTemplate'
import { absoluteUrl } from './siteConfig'

const HEAD_MARKER = '<!-- ssg:head -->'
const BODY_MARKER = '<!-- ssg:body -->'

interface Route {
    readonly meta: PageMeta
    readonly content: string
    readonly activeNav: string
    /** Sitemap priority (0-1). */
    readonly priority: number
}

function buildRoutes(repoRoot: string): Route[] {
    return [
        {
            meta: overviewMeta,
            content: overviewContent(),
            activeNav: 'overview',
            priority: 1.0,
        },
        {
            meta: playerMeta,
            content: playerContent(),
            activeNav: 'player',
            priority: 0.8,
        },
        ...docsPages(repoRoot).map(
            (p): Route => ({
                meta: p.meta,
                content: p.content,
                activeNav: p.activeNav,
                priority: p.meta.path === '/docs/' ? 0.8 : 0.6,
            })
        ),
    ]
}

function readVinylVersion(repoRoot: string): string {
    try {
        const json = JSON.parse(
            readFileSync(
                resolve(repoRoot, 'packages/vinyl/package.json'),
                'utf-8'
            )
        ) as { version?: string }
        return json.version ?? '0.0.0'
    } catch {
        return '0.0.0'
    }
}

/** Fills the SSG markers in `shell` with a route's head + body. */
function fillShell(shell: string, route: Route, version: string): string {
    const head = renderHeadMeta(route.meta)
    const body = renderBody({
        activeNav: route.activeNav,
        content: route.content,
        version,
    })
    const html = shell
        .replace(HEAD_MARKER, () => head)
        .replace(BODY_MARKER, () => body)
    if (html === shell) {
        throw new Error(
            'SSG markers not found — check the ssg:head / ssg:body comments in src/index.html'
        )
    }
    return html
}

/** Maps a route path to its output file, e.g. `/docs/x/` → `docs/x/index.html`. */
function outputFile(distDir: string, path: string): string {
    const clean = path.replace(/^\/+|\/+$/g, '')
    return clean === ''
        ? resolve(distDir, 'index.html')
        : resolve(distDir, clean, 'index.html')
}

function writeSitemap(distDir: string, routes: readonly Route[]): void {
    const lastmod = new Date().toISOString().slice(0, 10)
    const urls = routes
        .map(
            (r) =>
                `    <url>\n        <loc>${absoluteUrl(r.meta.path)}</loc>\n        <lastmod>${lastmod}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>${r.priority.toFixed(1)}</priority>\n    </url>`
        )
        .join('\n')
    writeFileSync(
        resolve(distDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    )
}

function writeRobots(distDir: string): void {
    writeFileSync(
        resolve(distDir, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
    )
}

/** Normalizes a request path to the route form (leading + trailing slash). */
function normalizePath(path: string): string {
    const clean = path.split('?')[0].split('#')[0]
    if (clean === '/' || clean === '') return '/'
    return clean.endsWith('/') ? clean : clean + '/'
}

/**
 * Generates a static HTML file per route after the client bundle is built
 * (`closeBundle`), by filling the `ssg:head`/`ssg:body` markers in the built
 * `index.html` — which already carries Vite's hashed asset + legacy script
 * tags — with per-page SEO head and pre-rendered content, plus `sitemap.xml`
 * and `robots.txt`. In dev (`configureServer`) it renders the same routes
 * on-the-fly so the site works without a build.
 */
export function ssgPlugin(repoRoot: string): Plugin {
    let distDir = ''
    let srcRoot = ''
    let base = '/'
    return {
        name: 'vinyl-ssg',
        enforce: 'post',
        configResolved(config) {
            srcRoot = config.root
            base = config.base
            distDir = resolve(config.root, config.build.outDir)
        },
        configureServer(server) {
            // Serve the rendered page for navigations; let everything else
            // (assets, HMR, public files) fall through to Vite.
            server.middlewares.use((req, res, next) => {
                const accept = req.headers.accept ?? ''
                if (req.method !== 'GET' || !accept.includes('text/html')) {
                    return next()
                }
                const url = req.url ?? '/'
                // Strip the base prefix (e.g. /vinyl/) before matching routes.
                const rel = url.startsWith(base)
                    ? url.slice(base.length - 1)
                    : url
                const path = normalizePath(rel)
                const route = buildRoutes(repoRoot).find(
                    (r) => r.meta.path === path
                )
                if (!route) return next()
                const template = readFileSync(
                    resolve(srcRoot, 'index.html'),
                    'utf-8'
                )
                server
                    .transformIndexHtml(req.url ?? '/', template)
                    .then((shell) => {
                        const html = fillShell(
                            shell,
                            route,
                            readVinylVersion(repoRoot)
                        )
                        res.setHeader('Content-Type', 'text/html')
                        res.end(html)
                    })
                    .catch(next)
            })
        },
        closeBundle() {
            const shell = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
            const version = readVinylVersion(repoRoot)
            const routes = buildRoutes(repoRoot)
            for (const route of routes) {
                const html = fillShell(shell, route, version)
                const file = outputFile(distDir, route.meta.path)
                mkdirSync(dirname(file), { recursive: true })
                writeFileSync(file, html)
            }
            writeSitemap(distDir, routes)
            writeRobots(distDir)
        },
    }
}
