/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { element, elements, type XmlRules } from '@amazon/vinyl-xml'
import { dashNamespaceUri } from '@/manifest/dashManifestXmlRules'

/**
 * ContentProtection extension point for Dash manifests.
 *
 * @module
 */

export interface WithProtections<T> {
    readonly ContentProtection?: readonly T[]
}

export interface RepresentationTypeProtections<T> extends WithProtections<T> {
    readonly SubRepresentation?: readonly WithProtections<T>[]
}

export interface AdaptationSetProtections<T> extends WithProtections<T> {
    readonly Representation?: readonly RepresentationTypeProtections<T>[]
}

export interface PeriodProtections<T> {
    readonly AdaptationSet?: readonly AdaptationSetProtections<T>[]
}

export interface MPDProtections<T> {
    readonly Period: readonly PeriodProtections<T>[]
}

export interface DashProtections<T> {
    readonly MPD: MPDProtections<T>
}

/**
 * Creates a dash extension for content protection parsing rules.
 *
 * @param contentProtectionRules Rules to be used when processing `ContentProtection` elements.
 * @return Returns a rules map that should be merged with the dash manifest rules.
 */
export function createDashProtectionXmlRules<T extends object>(
    contentProtectionRules: XmlRules<T>
): XmlRules<DashProtections<T>> {
    const withProtections: XmlRules<WithProtections<T>> = {
        ContentProtection: elements(contentProtectionRules),
    } as const

    return {
        MPD: element<MPDProtections<T>>(
            {
                Period: elements<PeriodProtections<T>>(
                    {
                        AdaptationSet: elements<AdaptationSetProtections<T>>({
                            ...withProtections,
                            Representation: elements<
                                RepresentationTypeProtections<T>
                            >({
                                ...withProtections,
                                SubRepresentation:
                                    elements<WithProtections<T>>(
                                        withProtections
                                    ),
                            }),
                        }),
                    },
                    {
                        minOccurs: 1,
                    }
                ),
            },
            { required: true, namespaceUri: dashNamespaceUri } as const
        ),
    } as const
}
