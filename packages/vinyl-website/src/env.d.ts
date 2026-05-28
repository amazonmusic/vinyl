/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

declare module '*.md' {
    const content: string
    export default content
}

declare module 'virtual:docs-manifest' {
    const manifest: Array<{
        slug: string
        title: string
        category: string
        html: string
    }>
    export default manifest
}

/**
 * Replaced at build time by the highlight plugin with the syntax-highlighted
 * HTML for the given code (highlight.js typescript/shell grammar). The tag
 * does not exist at runtime — interpolations are not supported.
 */
declare function highlightTs(strings: TemplateStringsArray): string
declare function highlightShell(strings: TemplateStringsArray): string
