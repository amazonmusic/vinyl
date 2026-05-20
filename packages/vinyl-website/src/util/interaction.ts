/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DomEventHost } from '@amazon/vinyl-util'

export const windowEvents = new DomEventHost<WindowEventMap>(window)
