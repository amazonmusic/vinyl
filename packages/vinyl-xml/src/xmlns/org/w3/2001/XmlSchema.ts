/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A subset of types defined in 2001 XmlSchema needed for dash parsing.
 * Source: https://www.w3.org/2001/XmlSchema.xsd
 *
 * @module
 */

/**
 * A Uniform Resource Identifier Reference
 */
export type Uri = string

export interface Base64BinaryType {
    _content: string
}

export interface UriType {
    _content: Uri
}
