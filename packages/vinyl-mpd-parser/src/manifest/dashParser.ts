/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReservedXmlRuleKeys } from '@amazon/vinyl-xml'
import {
    mapXmlRules,
    type Merged,
    mergeXmlRules,
    parseXml,
    ParseXmlHandlerImpl,
    stringifyXml,
} from '@amazon/vinyl-xml'
import type { PlayreadyContentProtection } from '@/xmlns/microsoft/playready'
import type { CencContentProtection } from '@/xmlns/mpeg/cenc/2013'
import type {
    DashManifest,
    DescriptorType,
} from '@/xmlns/mpeg/dash/schema/mpd/2011'
import { dashManifestXmlRules } from './dashManifestXmlRules'
import { cencXmlRules } from './ext/drm/cencXmlRules'
import type { DashProtections } from './ext/drm/contentProtection'
import { createDashProtectionXmlRules } from './ext/drm/contentProtection'
import { playreadyXmlRules } from './ext/drm/playreadyXmlRules'
import type { OptionalDeep } from '@amazon/vinyl-util'

/**
 * Creates a Dash Manifest parser with supported extensions.
 *
 * @module
 */

export type DashDrmManifest = Merged<
    DashManifest & DashProtections<ContentProtection>
>

export interface ContentProtection
    extends DescriptorType,
        CencContentProtection,
        PlayreadyContentProtection {}

const dashDrmRules = mergeXmlRules(
    dashManifestXmlRules(),
    createDashProtectionXmlRules(cencXmlRules),
    createDashProtectionXmlRules(playreadyXmlRules)
)

const dashDrmRulesMapped = mapXmlRules(dashDrmRules)

/**
 * A Content handler for a dash manifest.
 */
function dashManifestHandler() {
    return new ParseXmlHandlerImpl(dashDrmRulesMapped)
}

/**
 * Parses a Dash Manifest, according to the mpd:2011 schema.
 * @see https://raw.githubusercontent.com/Dash-Industry-Forum/MPEG-Conformance-and-reference-source/master/conformance/MPDValidator/schemas/DASH-MPD.xsd
 * @param manifest
 */
export function parseDashManifest(manifest: string): DashDrmManifest {
    return parseXml(manifest, dashManifestHandler())
}

export function stringifyDashManifest(
    manifest: OptionalDeep<DashDrmManifest, ReservedXmlRuleKeys>
): string {
    return stringifyXml(manifest, dashDrmRulesMapped)
}
