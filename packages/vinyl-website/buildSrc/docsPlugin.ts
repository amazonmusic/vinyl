/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Plugin, ViteDevServer } from 'vite'
import { resolve } from 'path'
import { globSync } from 'glob'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

interface DocInfo {
    title: string
    filename: string
    category: string
    html: string
}

const MANIFEST_ID = 'virtual:docs-manifest'
const RESOLVED_ID = '\0' + MANIFEST_ID

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

function categorize(filepath: string): string {
    if (filepath === 'README.md') return 'Overview'
    if (filepath.endsWith('/USAGE.md')) return 'Overview'
    if (filepath.includes('vinyl-util/')) return 'Util'
    if (filepath.includes('packages/vinyl/')) return 'Core'
    return 'Packages'
}

export function docsPlugin(root: string): Plugin {
    const mdFiles = [
        'README.md',
        ...globSync('packages/*/docs/*.md', {
            cwd: root,
        }).sort(),
    ]

    function buildDocs(): DocInfo[] {
        return mdFiles.map((file) => {
            const content = readFileSync(resolve(root, file), 'utf-8')
            const titleMatch = content.match(/^#\s+(.*)$/m)
            const title = titleMatch
                ? titleMatch[1].trim()
                : basename(file, '.md')
            const category = categorize(file)
            const filename = basename(file)

            const processed = content.replace(
                /\]\(([^)]*\.md)\)/g,
                (_, mdPath) => {
                    const name = mdPath.split('/').pop()!
                    const slug = name.replace('.md', '')
                    return `](#!/docs/${slug})`
                }
            )

            const html = md.parse(processed) as string
            return { title, filename, category, html }
        })
    }

    let docs: DocInfo[] = []

    return {
        name: 'vinyl-docs',
        buildStart() {
            docs = buildDocs()
        },
        configureServer(server: ViteDevServer) {
            docs = buildDocs()
            for (const file of mdFiles) {
                server.watcher.add(resolve(root, file))
            }
            server.watcher.on('change', (path) => {
                if (path.endsWith('.md')) {
                    docs = buildDocs()
                    const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
                    if (mod) server.moduleGraph.invalidateModule(mod)
                    server.ws.send({ type: 'full-reload' })
                }
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
