/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The seekable time range on the media timeline, in seconds.
 * `end` will be `Infinity` when a live stream.
 */
export type SeekRange = { readonly start: number; readonly end: number }
