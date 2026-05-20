/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogTarget } from '@amazon/vinyl-util'

export interface BasicErrorEvent {
    /**
     * The target reporting the error.
     */
    readonly target: LogTarget

    /**
     * The error.
     */
    readonly error: Error
}
