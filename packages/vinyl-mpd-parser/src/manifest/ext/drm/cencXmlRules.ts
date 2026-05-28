/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    parseStringVector,
    stringifyStringVector,
} from '../../dashManifestXmlRules'
import type { XmlRules } from '@amazon/vinyl-xml'
import { attr, charactersString, element } from '@amazon/vinyl-xml'
import type { CencContentProtection } from '../../../xmlns/mpeg/cenc/2013'
import { CENC_NAMESPACE_URI } from '../../../xmlns/mpeg/cenc/2013'

/**
 * A parser for ContentProtection elements using the cenc namespace.
 * @see https://github.com/sannies/rtp2dash/blob/master/src/main/resources/auxxsd/cenc.xsd
 */
export const cencXmlRules: XmlRules<CencContentProtection> = {
    default_KID: attr(parseStringVector, stringifyStringVector, {
        namespaceUri: CENC_NAMESPACE_URI,
    }),
    pssh: element(
        {
            _content: charactersString,
        },
        {
            namespaceUri: CENC_NAMESPACE_URI,
        }
    ),
} as const
