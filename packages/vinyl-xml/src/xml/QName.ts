/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Uri } from '@/xmlns/org/w3/2001/XmlSchema'

/**
 * An XML name for an element or attribute.
 */
export interface QName {
    /**
     * The fully qualified name.
     * This will be the prefixed name or the unprefixed name if the prefix is empty.
     * The prefixed name will be `prefix ':' localPart`
     */
    readonly qName: string

    /**
     * The xmlns prefix.
     */
    readonly prefix: string | null

    /**
     * The local part of this name.
     */
    readonly localPart: string

    /**
     * The resolved xmlns uri for the associated prefix.
     */
    readonly namespaceUri: Uri | null
}

/**
 * Creates a new {@link QName} object.
 *
 * @param localPart
 * @param prefix
 * @param namespaceUri
 */
export function qName(
    localPart: string,
    prefix: string | null = null,
    namespaceUri: Uri | null = null
): QName {
    return {
        localPart,
        prefix,
        namespaceUri,
        qName: prefix ? `${prefix}:${localPart}` : localPart,
    }
}
