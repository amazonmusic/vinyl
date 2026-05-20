/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentType } from './MediaQualityMetadata'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { ReadonlySet } from '@amazon/vinyl-util'

/**
 * Provides the content types to create streams for.
 */
export type ContentTypesValue = ObservableValue<
    Promise<ReadonlySet<ContentType>>
>
