/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ownKeys } from '@amazon/vinyl-util'
import type { Validator } from './Validator'

/**
 * The `type` keyword value of a JSON Schema node.
 */
export type JsonSchemaType =
    'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'

/**
 * A JSON Schema definition (a draft-07 compatible subset) describing the shape a value must take.
 *
 * This is the serializable representation produced by {@link toJsonSchema}, suitable for handing to
 * an LLM as the shape it must produce. It intentionally mirrors zod-to-json-schema output for the
 * node types this library supports.
 */
export interface JsonSchema {
    readonly type?: JsonSchemaType | readonly JsonSchemaType[]

    /**
     * A human-readable description, attached to a schema node via its `describe` method.
     */
    readonly description?: string

    // Object
    readonly properties?: Readonly<Record<string, JsonSchema>>
    readonly required?: readonly string[]
    readonly additionalProperties?: boolean | JsonSchema

    // Array
    readonly items?: JsonSchema | readonly JsonSchema[]
    readonly additionalItems?: boolean
    readonly minItems?: number
    readonly maxItems?: number
    readonly uniqueItems?: boolean

    // String
    readonly minLength?: number
    readonly maxLength?: number
    readonly pattern?: string

    // Number
    readonly minimum?: number
    readonly maximum?: number
    readonly exclusiveMinimum?: number
    readonly exclusiveMaximum?: number

    // Enumeration
    readonly enum?: readonly unknown[]

    // Composition
    readonly anyOf?: readonly JsonSchema[]
}

/**
 * A source that can produce its own JSON Schema definition. Schema nodes implement this so that
 * per-node metadata (such as a `describe` description) is honored during serialization.
 */
export interface JsonSchemaProvider {
    toJsonSchema(): JsonSchema
}

type MutableJsonSchema = {
    -readonly [K in keyof JsonSchema]: JsonSchema[K]
}

/**
 * Merges JSON Schema fragments into a single definition, later fragments taking precedence.
 *
 * This mirrors an intersection (`and`) of constraints: `properties` are combined and `required`
 * keys are unioned, while all other keywords are overridden by the last fragment that defines them.
 *
 * @param fragments The fragments to merge. `undefined` fragments are ignored.
 */
export function mergeJsonSchema(
    ...fragments: readonly (JsonSchema | undefined)[]
): JsonSchema {
    const merged: MutableJsonSchema = {}
    for (const fragment of fragments) {
        if (fragment == null) continue
        for (const key of ownKeys(fragment)) {
            if (fragment[key] === undefined) continue
            if (key === 'properties') {
                merged.properties = {
                    ...merged.properties,
                    ...fragment.properties,
                }
            } else if (key === 'required') {
                merged.required = [
                    ...new Set([
                        ...(merged.required ?? []),
                        ...(fragment.required as readonly string[]),
                    ]),
                ]
            } else {
                // A homogeneous copy of one key; the key/value are drawn from the same fragment.
                merged[key] = fragment[key] as never
            }
        }
    }
    return merged
}

/**
 * Serializes a validator to a JSON Schema definition.
 *
 * Schema nodes ({@link JsonSchemaProvider}s) serialize themselves so that per-node metadata is
 * honored; other validators contribute their attached JSON Schema fragment, defaulting to the empty
 * schema (which matches any value) when none is attached.
 *
 * @param source The validator or schema node to serialize.
 */
export function toJsonSchema(source: Validator<any, any>): JsonSchema {
    const provider = source as Partial<JsonSchemaProvider>
    if (typeof provider.toJsonSchema === 'function') {
        return provider.toJsonSchema()
    }
    return { ...source.jsonSchema }
}
