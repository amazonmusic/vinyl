/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * parseDashManifest is tested in the parseDash_xx.test files.
 * @module
 */

import { expectTypeExtends } from '@amazon/vinyl-util/browserTestUtil'
import type { DashDrmManifest, DashManifest } from '@amazon/vinyl-mpd-parser'

describe('DashDrmManifest', () => {
    it('extends DashManifest', () => {
        expectTypeExtends<DashDrmManifest, DashManifest>(true)
    })
})
