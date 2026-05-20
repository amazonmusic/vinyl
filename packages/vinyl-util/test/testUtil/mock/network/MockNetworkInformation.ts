/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    NetworkInformation,
    NetworkInformationEffectiveType,
    NetworkInformationType,
} from '@amazon/vinyl-util'
import { MockEventTarget } from '@amazon/vinyl-util/browserTestUtil'

export class MockNetworkInformation
    extends MockEventTarget
    implements NetworkInformation
{
    downlink: number | undefined = undefined
    effectiveType: NetworkInformationEffectiveType = '4g'
    rtt = 0
    saveData = false
    type?: NetworkInformationType = undefined
}
