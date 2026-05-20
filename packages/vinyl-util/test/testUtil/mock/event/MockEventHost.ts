/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventHostImpl } from '@amazon/vinyl-util'
import type { SpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

/**
 * MockEventHost creates spies with pass-through calls to the EventHost implementation.
 * While this is not a true mock, events become easier to test when using a real event dispatcher.
 */
export class MockEventHost<EventMap = any> extends EventHostImpl<EventMap> {
    private readonly spyFactory: SpyFactory<EventHostImpl<EventMap>> =
        createSpyFactory((key) => {
            return super[key].bind(this)
        })

    logPrefix = 'MockEventHost'
    hasAnyListeners = this.spyFactory('hasAnyListeners')
    hasListeners = this.spyFactory('hasListeners')
    dispatch = this.spyFactory('dispatch')
    on = this.spyFactory('on')
    dispose = this.spyFactory('dispose')
}
