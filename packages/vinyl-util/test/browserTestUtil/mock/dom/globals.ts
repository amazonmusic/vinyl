/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockAbortSignal, MockMediaSource } from './lib.dom'
import { createSpy2 } from '../createSpyFactory'

export class MockMediaSourceGlobal extends MockMediaSource {
    static canConstructInDedicatedWorker = false
    static isTypeSupported =
        createSpy2<(typeof global.MediaSource)['isTypeSupported']>(
            'isTypeSupported'
        )
}

export class MockAbortSignalGlobal extends MockAbortSignal {
    static abort = createSpy2<(typeof global.AbortSignal)['abort']>('abort')
    static any = createSpy2<(typeof global.AbortSignal)['any']>('any')
    static timeout =
        createSpy2<(typeof global.AbortSignal)['timeout']>('timeout')
}
