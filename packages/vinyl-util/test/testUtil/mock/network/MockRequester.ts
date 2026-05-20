/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Requester, RequesterImplEventMap } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@/mock/event/MockEventHost'

const spyFactory = createSpyFactory<Requester>()
export class MockRequester
    extends MockEventHost<RequesterImplEventMap>
    implements Requester
{
    request = spyFactory('request')
}
