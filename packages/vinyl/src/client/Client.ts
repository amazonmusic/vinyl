/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capabilities } from './Capabilities'

/**
 * Provides information about the client, such as device and browser capabilities.
 */
export interface Client {
    /**
     * Browser and platform capabilities.
     */
    readonly capabilities: Capabilities
}
