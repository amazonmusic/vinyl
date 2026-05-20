/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Client } from '@amazon/vinyl'
import { MockCapabilities } from './MockCapabilities'

export class MockClient implements Client {
    capabilities = new MockCapabilities()
}
