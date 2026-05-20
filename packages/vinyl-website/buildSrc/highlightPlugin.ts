/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Plugin } from 'vite'
import hljs from 'highlight.js'

const TAG_LANG: Record<string, string> = {
    highlightTs: 'typescript',
    highlightShell: 'shell',
}

const TAG_NAMES = Object.keys(TAG_LANG)

function buildPattern(): RegExp {
    const alternation = TAG_NAMES.join('|')
    return new RegExp(`\\b(${alternation})\`((?:\\\\.|[^\`\\\\])*)\``, 'g')
}

function decodeCooked(raw: string): string {
    return raw.replace(/\\([\\`$nrt])/g, (_, ch: string) => {
        if (ch === 'n') return '\n'
        if (ch === 'r') return '\r'
        if (ch === 't') return '\t'
        return ch
    })
}

export function highlightPlugin(): Plugin {
    const pattern = buildPattern()
    return {
        name: 'vinyl-static-highlight',
        enforce: 'pre',
        transform(src, id) {
            if (!/\.(t|j)sx?$/.test(id)) return null
            if (id.includes('node_modules')) return null
            if (!TAG_NAMES.some((tag) => src.includes(tag + '`'))) return null

            let mutated = false
            const out = src.replace(pattern, (_, tag: string, body: string) => {
                mutated = true
                const html = hljs.highlight(decodeCooked(body), {
                    language: TAG_LANG[tag],
                }).value
                return JSON.stringify(html)
            })
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!mutated) return null
            return { code: out, map: null }
        },
    }
}
