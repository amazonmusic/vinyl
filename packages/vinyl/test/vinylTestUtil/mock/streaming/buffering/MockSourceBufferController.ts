/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { type SourceBufferController } from '@amazon/vinyl'

import { RangesImpl } from '@amazon/vinyl-util'

const spyFactory = createSpyFactory<SourceBufferController>()

export class MockSourceBufferController implements SourceBufferController {
    buffered = new RangesImpl()

    append = spyFactory('append')

    appendInit = spyFactory('appendInit')

    clear = spyFactory('clear')

    enqueue = spyFactory('enqueue')

    isBusy = spyFactory('isBusy')

    remove = spyFactory('remove')

    setAppendWindow = spyFactory('setAppendWindow')

    setTimestampOffset = spyFactory('setTimestampOffset')

    dispose = spyFactory('dispose')
}
