/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs'

/**
 * The Amazon Vinyl logo, inlined so it's drawn in `currentColor` and follows
 * the theme (an `<img>` can't inherit the text color).
 */
export const LOGO_SVG = readFileSync(
    new URL('../public/img/logo.svg', import.meta.url),
    'utf8'
).trim()
