/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { charactersString, element, type XmlRules } from '@amazon/vinyl-xml'
import type { PlayreadyContentProtection } from '../../../xmlns/microsoft/playready'
import { PLAY_READY_NAMESPACE_URI } from '../../../xmlns/microsoft/playready'

export const playreadyXmlRules: XmlRules<PlayreadyContentProtection> = {
    pro: element(
        {
            _content: charactersString,
        },
        {
            namespaceUri: PLAY_READY_NAMESPACE_URI,
        }
    ),
} as const
