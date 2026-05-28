/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BaseURLType, RepresentationType } from '@amazon/vinyl-mpd-parser'
import { getRepresentationAncestry } from './mpd'
import type { Uri } from '@amazon/vinyl-xml'
import type { Maybe } from '@amazon/vinyl-util'
import {
    ErrorOrigin,
    IllegalArgumentError,
    resolveUrl,
    substituteIdentifiers,
    ValidationError,
} from '@amazon/vinyl-util'

/**
 * Selects a base URL alternate.
 */
export interface BaseUrlSelector {
    /**
     * Given a list of Dash base URLs, chooses which one will be used.
     *
     * @param baseUrls A list of Dash base URL objects for a single scope.
     * Guaranteed to not be empty.
     */
    selectBaseUrl(baseUrls: readonly BaseURLType[]): BaseURLType
}

export const pickFirstBaseUrlSelector: BaseUrlSelector = {
    selectBaseUrl(baseUrls: readonly BaseURLType[]): BaseURLType {
        return baseUrls[0]
    },
}

export interface DashUriResolveDeps {
    /**
     * Selects the BaseURL from provided alternates.
     */
    readonly baseUrlSelector: BaseUrlSelector
}

export interface ResolvedDashUri {
    /**
     * The absolute URL.
     */
    readonly url: string

    /**
     * The service location.
     * @see BaseURL.serviceLocation
     */
    readonly serviceLocation: string | null
}

export interface DashUriResolveOptions {
    /**
     * The URI to resolve.
     */
    readonly uri?: Maybe<Uri>

    /**
     * The representation to use as the scope for BaseURL resolution.
     */
    readonly representation: RepresentationType

    /**
     * The resource location of the manifest.
     */
    readonly baseUrl: string
}

/**
 * Resolves the base URL. Walks down the ancestry, concatenating BaseURL paths according to
 * MPEG-DASH ISO/IEC 23009-1 standard, section 5.6.4.
 *
 * The BaseURL elements are used to define the base URL against which relative URLs specified in the manifest are
 * resolved. This can occur at multiple levels within the manifest (e.g., at the Period, Adaptation Set, or
 * Representation level).
 * Relative URLs are resolved according to standard URL resolution rules, as defined by RFC 3986. This involves
 * resolving the relative URL against the effective base URL, which could be the URL of the manifest itself or
 * a <BaseURL> specified at a higher level in the manifest hierarchy.
 *
 * Manifest URL as Base: If no <BaseURL> is specified, the URL from which the DASH manifest (MPD file) was
 * retrieved acts as the base URL for resolving any relative URLs.
 *
 * https://standards.iso.org/ittf/PubliclyAvailableStandards/index.html
 *
 * Note: URL resolution is not a simple concatenation, the `URL` class is used to resolve relative URLs per RFC
 * 3986:2005.
 *
 * @return Returns a resolved BaseURL object with calculated values according to inheritance rules.
 */
export function resolveDashUri(
    deps: DashUriResolveDeps,
    options: DashUriResolveOptions
): ResolvedDashUri {
    const { representation, baseUrl, uri } = options
    const baseUrlSelector = deps.baseUrlSelector

    const scopeChain = getRepresentationAncestry(representation)

    let resolved = baseUrl
    let serviceLocation: string | null = null
    scopeChain.forEach((scope) => {
        if (scope.BaseURL && scope.BaseURL.length) {
            const selectedBaseUrl = baseUrlSelector.selectBaseUrl(scope.BaseURL)
            resolved = resolveUrl(selectedBaseUrl._content, resolved)
            if (selectedBaseUrl.serviceLocation)
                serviceLocation = selectedBaseUrl.serviceLocation
        }
    })
    if (uri != null) {
        resolved = resolveUrl(uri, resolved)
    } else if (resolved === baseUrl) {
        throw new ValidationError(
            'media missing URI or BaseURL',
            ErrorOrigin.MEDIA
        )
    }
    return { url: resolved, serviceLocation }
}

export interface SegmentTemplateUriOptions {
    /**
     * The sequence number of the segment. Will replace `$Number$` in url templates.
     */
    readonly segmentNumber?: Maybe<number>

    /**
     * The sample time of the segment. Will replace `$Time$` in url templates.
     */
    readonly sampleTime?: Maybe<number>

    /**
     * The representation, will use the id and bandwidth for replacement tokens.
     */
    readonly representation: RepresentationType
}

/**
 * Supported segment template tokens
 *
 * Does not currently support SubNumber.
 */
interface SegmentTemplateTokens {
    /**
     * This placeholder is replaced by the ID of the representation.
     */
    readonly RepresentationID: string

    /**
     * This placeholder is replaced by the sequence number of the segment.
     */
    readonly Number: number

    /**
     * This placeholder is replaced by the calculated sample time of the segment.
     */
    readonly Time: number

    /**
     * Replaced by the bandwidth attribute of the representation.
     */
    readonly Bandwidth: number
}

/**
 * Creates a segment url using segment template tokens, as defined in 5.3.9.4.4.
 */
export function segmentTemplateUrl(
    uri: Uri,
    options: SegmentTemplateUriOptions
): Uri {
    try {
        return substituteIdentifiers(uri, {
            Bandwidth: options.representation.bandwidth,
            Number: options.segmentNumber ?? 0,
            RepresentationID: options.representation.id,
            Time: options.sampleTime ?? 0,
        } as const satisfies SegmentTemplateTokens)
    } catch (error) {
        if (error instanceof IllegalArgumentError) {
            // An IllegalArgumentError here indicates that a template URL provided was unsupported.
            throw new ValidationError(error.message, ErrorOrigin.MEDIA)
        } else {
            throw error
        }
    }
}
