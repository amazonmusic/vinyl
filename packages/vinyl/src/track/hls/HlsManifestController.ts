/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ManifestController } from '../../streaming/ManifestController'
import type { HlsManifestData } from './HlsManifestData'

export type HlsManifestController = ManifestController<Promise<HlsManifestData>>
