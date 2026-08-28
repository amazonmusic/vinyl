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
import { withBase } from './siteConfig'

export interface DocInfo {
    slug: string
    title: string
    category: string
    html: string
    /** Plain-text excerpt (first paragraph) for meta descriptions. */
    description: string
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

/**
 * Derives a plain-text meta-description excerpt: the first prose paragraph,
 * stripped of Markdown syntax and truncated to a search-friendly length. Every
 * angle bracket is removed (not just whole tags), so the result can never carry
 * HTML markup; it is additionally HTML-/JSON-escaped wherever it is emitted.
 */
function descriptionFor(content: string, title: string): string {
    const clean = (line: string): string =>
        line
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images / badges
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
            .replace(/`([^`]*)`/g, '$1') // inline code
            .replace(/[*_~]/g, '') // emphasis marks
            .replace(/</g, '') // drop all angle brackets so no tag can form
            .replace(/>/g, '')
            .replace(/\s+/g, ' ')
            .trim()

    let text = ''
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        // Skip structural lines (headings, fences, tables, comments, quotes).
        if (
            trimmed === '' ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('```') ||
            trimmed.startsWith('|') ||
            trimmed.startsWith('<!--') ||
            trimmed.startsWith('>')
        ) {
            if (text) break
            continue
        }
        const cleaned = clean(trimmed)
        // Skip lines that are only badges/images/links (clean to nothing).
        if (!cleaned) {
            if (text) break
            continue
        }
        text = text ? `${text} ${cleaned}` : cleaned
        if (text.length > 200) break
    }
    const source = text || `${title} — Amazon Vinyl documentation.`
    return source.length > 155 ? source.slice(0, 152).trimEnd() + '…' : source
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
                return `](${withBase(`/docs/${directSlug}/`)}${hash})${title}`
            }

            const dirReadme = knownDocs.get(posix.join(resolved, 'README.md'))
            if (dirReadme) {
                return `](${withBase(`/docs/${dirReadme}/`)}${hash})${title}`
            }

            return `](${GITHUB_BASE}/${resolved}${hash})${title}`
        }
    )
}

/**
 * Reads every public Markdown doc under `root` and renders it to HTML with
 * rewritten cross-links and a meta-description excerpt. Shared by the dev-time
 * virtual manifest and the static-site generator.
 */
export function buildDocs(root: string): DocInfo[] {
    const mdFiles = listMdFiles(root)
    const knownDocs = new Map(mdFiles.map((f) => [f, slugFor(f)]))

    return mdFiles.map((file) => {
        const content = readFileSync(resolve(root, file), 'utf-8')
        const slug = knownDocs.get(file)!
        const title = titleFor(content, slug)
        const category = categoryFor(file)
        const description = descriptionFor(content, title)
        const processed = rewriteLinks(content, file, knownDocs)
        // Make scrollable code blocks keyboard-focusable for a11y.
        const html = (md.parse(processed) as string).replace(
            /<pre>/g,
            '<pre tabindex="0">'
        )
        return { slug, title, category, html, description }
    })
}

export function docsPlugin(root: string): Plugin {
    let docs: DocInfo[] = []

    return {
        name: 'vinyl-docs',
        buildStart() {
            docs = buildDocs(root)
        },
        configureServer(server: ViteDevServer) {
            docs = buildDocs(root)
            for (const file of listMdFiles(root)) {
                server.watcher.add(resolve(root, file))
            }
            const reload = () => {
                docs = buildDocs(root)
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
