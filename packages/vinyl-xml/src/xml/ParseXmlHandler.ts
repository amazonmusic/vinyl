/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { QName } from './QName'
import type { XmlElement } from '@/xml/ParseXmlHandlerImpl'

/**
 * A handler for XML deserialization.
 */
export interface ParseXmlHandler<T> {
    /**
     * A new document has begun.
     */
    startDocument(): void

    /**
     * A document has completed parsing, the final object is ready.
     */
    endDocument(): T & XmlElement<T>

    /**
     * Invoked when a new element has been started, after the element's attributes have been read.
     *
     * @param name An object representing the element's name and namespace.
     * @param attributes The attributes associated with the currently opening element.
     */
    startElement(name: QName, attributes: Attributes): void

    /**
     * Invoked after an element closing tag.
     */
    endElement(): void

    /**
     * Provides a raw substring as a text node. The given text is expected to be decoded using
     * `decodeEntities`.
     *
     * @param str
     */
    textNode(str: string): void

    /**
     * Provides a raw substring as a cdata node. This text is _not_ expected to be decoded.
     *
     * @param str
     */
    cDataNode(str: string): void
}

/**
 * An attribute map, where the keys are the fully qualified attribute names.
 */
export interface Attributes {
    readonly [qName: string]: Attribute | undefined
}

export interface Attribute {
    /**
     * This attribute's name.
     */
    readonly name: QName

    /**
     * The unescaped attribute value.
     */
    readonly value: string
}
