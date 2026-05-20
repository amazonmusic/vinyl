/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Patch } from '@amazon/vinyl-util'

export type HtmlMediaElementPatch = Patch<
    HTMLMediaElement,
    HTMLMediaElementEventMap
>
