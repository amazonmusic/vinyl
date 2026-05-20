/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolves a relative URI against a base URL using string manipulation,
 * avoiding the overhead of constructing `URL` objects.
 *
 * Handles the same cases as `new URL(relative, base)`:
 * - Absolute URIs (with scheme) are returned as-is.
 * - Protocol-relative URIs (`//host/path`) inherit the base scheme.
 * - Absolute paths (`/path`) replace the base path.
 * - Relative paths are resolved against the base directory.
 *
 * @param relative The relative (or absolute) URI to resolve.
 * @param base The base URL string to resolve against.
 * @returns A resolved absolute URL string.
 */
export function resolveUrl(relative: string, base: string): string {
    // Absolute URI — has a scheme.
    if (relative.indexOf('://') > 0) return relative

    // Protocol-relative.
    if (relative.startsWith('//')) {
        const schemeEnd = base.indexOf('://')
        return base.substring(0, schemeEnd + 1) + relative
    }

    const schemeEnd = base.indexOf('://') + 3
    const pathStart = base.indexOf('/', schemeEnd)
    const origin = pathStart === -1 ? base : base.substring(0, pathStart)

    // Absolute path.
    if (relative.startsWith('/')) return origin + relative

    // Empty relative — return base as-is.
    if (relative === '') return base

    // Relative path — resolve against base directory.
    const basePath = pathStart === -1 ? '/' : base.substring(pathStart)
    const lastSlash = basePath.lastIndexOf('/')
    const dir = basePath.substring(0, lastSlash + 1)

    return origin + resolveDots(dir + relative)
}

/**
 * Extracts the hostname from an absolute URL string.
 *
 * @param url An absolute URL string (e.g. `https://example.com:8080/path`).
 * @returns The hostname (e.g. `example.com`).
 */
export function getHostname(url: string): string {
    const start = url.indexOf('://') + 3
    let end = url.indexOf('/', start)
    if (end === -1) end = url.length
    const hostPort = url.substring(start, end)
    const colon = hostPort.indexOf(':')
    return colon === -1 ? hostPort : hostPort.substring(0, colon)
}

/**
 * Resolves `.` and `..` segments in a path.
 */
function resolveDots(path: string): string {
    // Fast path: no dots to resolve.
    if (path.indexOf('.') === -1) return path

    const parts = path.split('/')
    const out: string[] = []
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        if (p === '..') {
            // Don't pop past root.
            if (out.length > 1) out.pop()
        } else if (p !== '.') {
            out.push(p)
        }
    }
    return out.join('/')
}
