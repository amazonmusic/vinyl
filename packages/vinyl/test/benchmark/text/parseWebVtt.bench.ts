/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseWebVtt } from '@amazon/vinyl'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import { addBenchmarks, setupBenchmark } from '../setup'
import { sampleVtt } from './sampleVtt'

/** Benchmarks the WebVTT parser over a large, complex document. */
describe('parseWebVtt', () => {
    setupBenchmark()

    it('parses a large document', async () => {
        addBenchmarks(
            'parseWebVtt - large document',
            await benchmark('parseWebVtt', () => parseWebVtt(sampleVtt))
        )
    })
})
