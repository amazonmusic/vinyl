/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockEvent } from './lib.dom'

/**
 * A convenience function to create a MockEvent with a given type.
 * @param type
 */
export function mockEvent(type: string): MockEvent {
    const e = new MockEvent()
    e.type = type
    return e
}
