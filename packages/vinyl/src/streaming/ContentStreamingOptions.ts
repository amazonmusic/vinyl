/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SegmentControllerImplOptions } from './SegmentControllerImpl'
import type { BufferingControllerImplOptions } from './buffering/BufferingController'

export interface ContentStreamingOptions {
    /**
     * Configuration for the segment controller.
     */
    readonly segmentController?: Partial<SegmentControllerImplOptions>

    /**
     * Configuration for the buffering controller.
     */
    readonly buffering?: Partial<BufferingControllerImplOptions>
}
