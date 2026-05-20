/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { dash_segmentListMediaRange } from '@amazon/vinyl-mpd-parser/dashTestAssets'
import { addBenchmarks, setupBenchmark } from '@/setup'

describe('parseDashManifest', () => {
    setupBenchmark()

    it('Parse Dash', async () => {
        addBenchmarks(
            'Parse Dash - isoff on demand',
            await benchmark('SAX', () =>
                parseDashManifest(dash_segmentListMediaRange)
            )
        )
    })
})
