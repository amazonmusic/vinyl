/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Required properties on AdaptationSetType
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'

export const mockDashManifest = parseDashManifest(
    // language=XML
    `<?xml version="1.0" ?>
<MPD profiles="" minBufferTime="PT0.0S" type="static" xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet>
      <Representation id="0" bandwidth="0"/>
    </AdaptationSet>
  </Period>
</MPD>`
)
