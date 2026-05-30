/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Plugin, ViteDevServer } from 'vite'
import { posix, resolve } from 'path'
import { globSync } from 'glob'
import { readFileSync } from 'fs'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

interface DocInfo {
    slug: string
    title: string
    category: string
    html: string
}

const MANIFEST_ID = 'virtual:docs-manifest'
const RESOLVED_ID = '\0' + MANIFEST_ID
const GITHUB_BASE = 'https://github.com/amazonmusic/vinyl/blob/main'

const md = new Marked(
    markedHighlight({
        highlight(code: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value
            }
            return hljs.highlightAuto(code).value
        },
    })
)

function slugFor(repoPath: string): string {
    if (repoPath === 'README.md') return 'README'
    const m = /^packages\/([^/]+)\/(.+)$/.exec(repoPath)
    if (!m) return repoPath.replace(/\.md$/, '').replace(/\//g, '-')
    const [, pkg, rest] = m
    if (rest === 'README.md') return pkg
    const stripped = rest.replace(/^docs\//, '').replace(/\.md$/, '')
    return `${pkg}-${stripped.replace(/\//g, '-').toLowerCase()}`
}

function categoryFor(repoPath: string): string {
    if (repoPath === 'README.md') return 'Overview'
    if (repoPath === 'packages/vinyl/docs/USAGE.md') return 'Overview'
    if (repoPath.startsWith('packages/vinyl/')) return 'Core'
    if (repoPath.startsWith('packages/vinyl-util/')) return 'Util'
    return 'Packages'
}

function titleFor(content: string, slug: string): string {
    const titleMatch = content.match(/^#\s+(.*)$/m)
    const raw = titleMatch ? titleMatch[1].trim() : slug
    return raw.replace(/^@[^/]+\//, '')
}

const EXCLUDED_PACKAGES = new Set(['vinyl-build-utils', 'vinyl-mock-generator'])

function isPrivatePackage(root: string, pkg: string): boolean {
    try {
        const json = JSON.parse(
            readFileSync(
                resolve(root, 'packages', pkg, 'package.json'),
                'utf-8'
            )
        ) as { private?: boolean }
        return json.private === true
    } catch {
        return false
    }
}

function listMdFiles(root: string): string[] {
    const isPublic = (file: string): boolean => {
        const m = /^packages\/([^/]+)\//.exec(file)
        if (!m) return true
        const pkg = m[1]
        return !EXCLUDED_PACKAGES.has(pkg) && !isPrivatePackage(root, pkg)
    }
    return [
        'README.md',
        ...globSync('packages/*/README.md', { cwd: root })
            .filter(isPublic)
            .sort(),
        ...globSync('packages/*/docs/**/*.md', { cwd: root })
            .filter(isPublic)
            .sort(),
    ]
}

function rewriteLinks(
    content: string,
    docPath: string,
    knownDocs: Map<string, string>
): string {
    const docDir = posix.dirname(docPath)

    return content.replace(
        /]\(([^)\s]+)(\s+"[^"]*")?\)/g,
        (full, href, title = '') => {
            if (
                /^[a-z][a-z0-9+.-]*:\/\//i.test(href) ||
                href.startsWith('#') ||
                href.startsWith('mailto:')
            ) {
                return full
            }

            const [pathPart, hashPart = ''] = href.split('#') as [
                string,
                string?,
            ]
            const hash = hashPart ? `#${hashPart}` : ''

            const resolved = pathPart.startsWith('/')
                ? pathPart.slice(1)
                : posix.normalize(posix.join(docDir, pathPart))

            if (resolved.startsWith('..')) {
                return full
            }

            const directSlug = knownDocs.get(resolved)
            if (directSlug) {
                return `](#!/docs/${directSlug}${hash})${title}`
            }

            const dirReadme = knownDocs.get(posix.join(resolved, 'README.md'))
            if (dirReadme) {
                return `](#!/docs/${dirReadme}${hash})${title}`
            }

            return `](${GITHUB_BASE}/${resolved}${hash})${title}`
        }
    )
}

export function docsPlugin(root: string): Plugin {
    let mdFiles = listMdFiles(root)

    function buildDocs(): DocInfo[] {
        const knownDocs = new Map(mdFiles.map((f) => [f, slugFor(f)]))

        return mdFiles.map((file) => {
            const content = readFileSync(resolve(root, file), 'utf-8')
            const slug = knownDocs.get(file)!
            const title = titleFor(content, slug)
            const category = categoryFor(file)
            const processed = rewriteLinks(content, file, knownDocs)
            const html = md.parse(processed) as string
            return { slug, title, category, html }
        })
    }

    let docs: DocInfo[] = []

    return {
        name: 'vinyl-docs',
        buildStart() {
            mdFiles = listMdFiles(root)
            docs = buildDocs()
        },
        configureServer(server: ViteDevServer) {
            mdFiles = listMdFiles(root)
            docs = buildDocs()
            for (const file of mdFiles) {
                server.watcher.add(resolve(root, file))
            }
            const reload = () => {
                mdFiles = listMdFiles(root)
                docs = buildDocs()
                const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
                if (mod) server.moduleGraph.invalidateModule(mod)
                server.ws.send({ type: 'full-reload' })
            }
            server.watcher.on('change', (path) => {
                if (path.endsWith('.md')) reload()
            })
            server.watcher.on('add', (path) => {
                if (path.endsWith('.md')) reload()
            })
            server.watcher.on('unlink', (path) => {
                if (path.endsWith('.md')) reload()
            })
        },
        resolveId(id) {
            if (id === MANIFEST_ID) return RESOLVED_ID
            return null
        },
        load(id) {
            if (id === RESOLVED_ID) {
                return `export default ${JSON.stringify(docs)};`
            }
            return null
        },
    }
}
