/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Base64BinaryType } from '@amazon/vinyl-xml'

/**
 * Cenc content protection playready.
 *
 * @see https://learn.microsoft.com/en-us/playready/specifications/mpeg-dash-playready#21-dash-contentprotection-descriptor-elements
 * @module
 */

export const PLAY_READY_NAMESPACE_URI = 'urn:microsoft:playready'

export interface PlayreadyContentProtection {
    readonly pro?: Base64BinaryType
}
