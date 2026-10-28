/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runs the integ suite in each source buffer append mode (`AppendMode`), read
 * by the test page's `appendMode` query parameter (see createVinylSuite).
 */
export const APPEND_MODE_VARIANTS = [
    { appendMode: 'segments' },
    { appendMode: 'sequence' },
] as const
