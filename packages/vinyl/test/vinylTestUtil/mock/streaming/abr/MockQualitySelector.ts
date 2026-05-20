/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type { QualitySelector } from '@amazon/vinyl'

const spyFactory = createSpyFactory<QualitySelector>()

export class MockQualitySelector implements QualitySelector {
    selectQuality = spyFactory('selectQuality')
}
