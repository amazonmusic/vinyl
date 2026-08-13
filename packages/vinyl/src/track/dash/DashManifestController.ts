/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ManifestController } from '../../streaming/ManifestController'
import type { DashManifestData } from './DashManifestProvider'

export type DashManifestController = ManifestController<
    Promise<DashManifestData>
>
