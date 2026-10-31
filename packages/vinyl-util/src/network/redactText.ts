/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The placeholder that replaces a masked secret.
 */
export const REDACTED = '[redacted]'

const SECRET_ASSIGNMENT =
    /((?:refresh_token|access_token|id_token|code_verifier|client_secret)["']?\s*[:=]\s*["']?)[^&#\s"',}]+/gi
const QUERY_CODE = /([?&#]code=)[^&#\s"']*/gi
const BEARER = /\b(Bearer\s+)[^\s"',]+/gi

/**
 * Masks token and secret values in free text, such as a URL, a form body or a JSON string.
 */
export function redactText(text: string): string {
    return text
        .replace(SECRET_ASSIGNMENT, `$1${REDACTED}`)
        .replace(QUERY_CODE, `$1${REDACTED}`)
        .replace(BEARER, `$1${REDACTED}`)
}
