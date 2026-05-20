/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

let _isNode: boolean | null = null

/**
 * Returns true if this is a nodejs environment.
 */
export function isNode(): boolean {
    if (_isNode === null) {
        _isNode =
            typeof process !== 'undefined' &&
            'versions' in process &&
            typeof process.versions.node === 'string'
    }
    return _isNode
}
/**
 * Node's global setTimeout differs slightly from the browser. Use this when storing timeout ids.
 */
export type TimeoutId = ReturnType<typeof setTimeout>

/**
 * A subset of `Location` properties available in all environments.
 */
export interface PartialLocation {
    readonly origin: string
    readonly search: string
    readonly href: string
}

/**
 * Returns the global `location` object, or a default with empty values
 * when `location` is not defined (e.g. Node, Web Workers).
 */
export function getLocation(): PartialLocation {
    return typeof location === 'object' ? location : defaultLocation
}

const defaultLocation: PartialLocation = {
    origin: '',
    search: '',
    href: '',
}

/**
 * Node's global setInterval differs slightly from the browser. Use this when storing interval ids.
 */
export type IntervalId = ReturnType<typeof setInterval>
