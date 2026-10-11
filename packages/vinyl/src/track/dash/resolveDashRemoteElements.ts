/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AdaptationSetType,
    type BaseURLType,
    type DashManifest,
    dashNamespaceUri,
    type EventStreamType,
    type MPDtype,
    parseDashManifest,
    type PeriodType,
    type RepresentationType,
    type SegmentListType,
    XLINK_NAMESPACE_URI,
} from '@amazon/vinyl-mpd-parser'
import {
    clone,
    logWarn,
    type LogTarget,
    type Maybe,
    type MutableRequestParams,
    noop,
    readResponseBody,
    type ReadonlyAbort,
    type RequestInitOptions,
    type RequestInterceptor,
    requestWithRetry,
    resolveUrl,
} from '@amazon/vinyl-util'
import type { DashManifestData } from './DashManifestProvider'

/**
 * An XLink href that resolves a remote element to nothing, removing it.
 */
export const XLINK_RESOLVE_TO_ZERO = 'urn:mpeg:dash:resolve-to-zero:2013'

/**
 * The maximum depth of remote elements referencing remote elements.
 */
const MAX_LINK_DEPTH = 5

const logTarget: LogTarget = { logPrefix: 'resolveDashRemoteElements' }

export interface ResolveDashRemoteElementsDeps {
    readonly requestInterceptor?: RequestInterceptor
    readonly requestInit?: Maybe<RequestInitOptions>
}

/**
 * Resolves a DASH manifest's remote content, so the result is a self-contained
 * presentation:
 *
 * - Linked Periods (ISO/IEC 23009-1 6th edition 5.3.2.6): a Period with an
 *   `ImportedMPD` takes the content of the referenced single-Period MPD,
 *   following the reference processing model of 5.3.2.6.3. This makes a list
 *   MPD (`MPD@type="list"`), whose Periods each import an MPD, playable as a
 *   multi-Period presentation.
 * - Remote elements (5.5): a `Period`, `AdaptationSet`, `EventStream`, or
 *   `SegmentList` with an `xlink:href` is replaced by the elements of the
 *   referenced fragment, resolving nested links up to a depth of 5. An href of
 *   {@link XLINK_RESOLVE_TO_ZERO} removes the element.
 *
 * Both `xlink:actuate="onLoad"` and `"onRequest"` links are resolved here, when
 * the manifest loads. A Linked Period or remote element that cannot be
 * resolved falls back to its own content, without the link, or is removed if
 * that leaves a Period without content.
 *
 * Returns the given data when it has no remote content.
 */
export async function resolveDashRemoteElements(
    deps: ResolveDashRemoteElementsDeps,
    data: DashManifestData,
    abort?: ReadonlyAbort
): Promise<DashManifestData> {
    if (!hasRemoteContent(data.manifest)) return data
    const manifest = clone(data.manifest) as DashManifest
    const fetchText = createFetchText(deps, abort)
    const mpd = manifest.MPD as Mutable<MPDtype>
    await resolveLinkedPeriods(fetchText, mpd, data.baseUrl)
    await resolveRemoteChildren(fetchText, mpd, data.baseUrl, 0)
    return { manifest, baseUrl: data.baseUrl }
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] }

type FetchText = (url: string) => Promise<{ text: string; url: string }>

function createFetchText(
    deps: ResolveDashRemoteElementsDeps,
    abort: ReadonlyAbort | undefined
): FetchText {
    const requestInterceptor = deps.requestInterceptor ?? noop
    return async (url) => {
        const params: MutableRequestParams = {
            input: url,
            init: clone(deps.requestInit) ?? {},
        }
        requestInterceptor(params)
        const response = await requestWithRetry(params.input, params.init, {
            abort,
        })
        const text = await readResponseBody(response, 'text')
        return { text, url: response.url || url }
    }
}

function hasRemoteContent(manifest: DashManifest): boolean {
    for (const period of manifest.MPD.Period) {
        if (period.ImportedMPD || period.href || period.SegmentList?.href)
            return true
        for (const eventStream of period.EventStream ?? []) {
            if (eventStream.href) return true
        }
        for (const adaptationSet of period.AdaptationSet ?? []) {
            if (adaptationSet.href || adaptationSet.SegmentList?.href)
                return true
            for (const representation of adaptationSet.Representation ?? []) {
                if (representation.SegmentList?.href) return true
            }
        }
    }
    return false
}

// ─── Linked Periods ─────────────────────────────────────────────────────────

async function resolveLinkedPeriods(
    fetchText: FetchText,
    mpd: Mutable<MPDtype>,
    baseUrl: string
): Promise<void> {
    const resolved = await Promise.all(
        mpd.Period.map(async (period) => {
            const imported = period.ImportedMPD
            if (!imported) return [period]
            const href = imported._content?.trim()
            let importedMpd: MPDtype | null = null
            let importedUrl = ''
            if (href) {
                try {
                    const response = await fetchText(resolveUrl(href, baseUrl))
                    importedUrl = response.url
                    importedMpd = parseDashManifest(response.text).MPD
                } catch (error) {
                    logWarn(
                        logTarget,
                        `Linked Period ${period.id} import failed`,
                        error
                    )
                }
            }
            if (!importedMpd || !isImportableMpd(importedMpd)) {
                return fallbackLinkedPeriod(period)
            }
            return [mergeImportedPeriod(mpd, period, importedMpd, importedUrl)]
        })
    )
    mpd.Period = resolved.flat()
}

/**
 * 5.3.2.6.3 step 1: an imported MPD must be a static, single-Period MPD that
 * is still available.
 */
function isImportableMpd(mpd: MPDtype): boolean {
    if (mpd.type !== 'static') return false
    if (mpd.Period.length !== 1) return false
    return (
        mpd.availabilityEndTime == null ||
        mpd.availabilityEndTime.getTime() >= Date.now()
    )
}

/**
 * 5.3.2.6.3 step 2: a Linked Period that cannot be resolved becomes a regular
 * Period, or is removed when it has no content.
 */
function fallbackLinkedPeriod(period: PeriodType): PeriodType[] {
    const regular = period as Mutable<PeriodType>
    delete regular.ImportedMPD
    if (!isValidPeriod(regular)) {
        logWarn(logTarget, `removing unresolved Linked Period ${period.id}`)
        return []
    }
    return [regular]
}

/**
 * A Period is valid when it has an AdaptationSet or a zero duration.
 */
function isValidPeriod(period: PeriodType): boolean {
    return !!period.AdaptationSet?.length || period.duration === 0
}

/**
 * 5.3.2.6.3 step 3: integrates the imported Period into the Linked Period.
 */
function mergeImportedPeriod(
    mpd: MPDtype,
    linked: PeriodType,
    importedMpd: MPDtype,
    importedUrl: string
): PeriodType {
    const imported = importedMpd.Period[0] as Mutable<PeriodType>
    // 3.d: the Linked Period's @id and @start take precedence; @duration is
    // the smaller of the two.
    const duration =
        linked.duration != null && imported.duration != null
            ? Math.min(linked.duration, imported.duration)
            : (linked.duration ?? imported.duration)
    // 3.c: an imported EventStream or SupplementalProperty replaces the
    // Linked Period's equivalent one.
    const descriptorKey = (d: {
        readonly schemeIdUri: string
        readonly value?: string
    }) => `${d.schemeIdUri}|${d.value ?? ''}`
    const importedEventStreams = imported.EventStream ?? []
    const importedEventKeys = new Set(importedEventStreams.map(descriptorKey))
    const importedProperties = [
        ...(imported.SupplementalProperty ?? []),
        ...(importedMpd.SupplementalProperty ?? []),
    ]
    const importedPropertyKeys = new Set(importedProperties.map(descriptorKey))
    const merged = imported
    merged.parent = mpd
    delete merged.ImportedMPD
    delete merged.id
    delete merged.start
    delete merged.duration
    if (linked.id != null) merged.id = linked.id
    if (linked.start != null) merged.start = linked.start
    if (duration != null) merged.duration = duration
    merged.EventStream = [
        ...importedEventStreams,
        ...(linked.EventStream ?? []).filter(
            (e) => !importedEventKeys.has(descriptorKey(e))
        ),
    ]
    merged.SupplementalProperty = [
        ...importedProperties,
        ...(linked.SupplementalProperty ?? []).filter(
            (p) => !importedPropertyKeys.has(descriptorKey(p))
        ),
    ]
    // 3.e: the imported MPD's base URLs are resolved to absolute URLs, which
    // become the Period's BaseURL.
    merged.BaseURL = resolveImportedBaseUrls(importedMpd, imported, importedUrl)
    for (const adaptationSet of merged.AdaptationSet ?? []) {
        ;(adaptationSet as Mutable<AdaptationSetType>).parent = merged
    }
    return merged
}

function resolveImportedBaseUrls(
    importedMpd: MPDtype,
    importedPeriod: PeriodType,
    importedUrl: string
): BaseURLType[] {
    let bases: BaseURLType[] = [{ _content: importedUrl }]
    for (const scope of [importedMpd.BaseURL, importedPeriod.BaseURL]) {
        if (!scope?.length) continue
        bases = bases.flatMap((base) =>
            scope.map((baseUrl) => ({
                ...baseUrl,
                _content: resolveUrl(baseUrl._content, base._content),
            }))
        )
    }
    return bases
}

// ─── Remote elements (XLink) ────────────────────────────────────────────────

/**
 * Wraps a remote element fragment in an MPD, so it can be parsed with the
 * MPD rules, and extracts the parsed elements.
 */
interface RemoteElementKind<T> {
    readonly wrap: (fragment: string) => string
    readonly extract: (mpd: MPDtype) => readonly T[]
    /**
     * Whether an element that failed to resolve can be kept without its link.
     */
    readonly isValid?: (element: T) => boolean
}

function mpdWrapper(inner: string): string {
    // Built on use: a module-level template of imported constants is not
    // tree-shaken.
    const namespaces =
        `xmlns="${dashNamespaceUri}" xmlns:xlink="${XLINK_NAMESPACE_URI}" ` +
        `xmlns:scte35="http://www.scte.org/schemas/35/2016" ` +
        `xmlns:cenc="urn:mpeg:cenc:2013" xmlns:mspr="urn:microsoft:playready"`
    return `<MPD ${namespaces} profiles="" minBufferTime="PT0S">${inner}</MPD>`
}

const PERIOD: RemoteElementKind<PeriodType> = {
    wrap: (fragment) => mpdWrapper(fragment),
    extract: (mpd) => mpd.Period,
    isValid: isValidPeriod,
}

const ADAPTATION_SET: RemoteElementKind<AdaptationSetType> = {
    wrap: (fragment) => mpdWrapper(`<Period>${fragment}</Period>`),
    extract: (mpd) => mpd.Period[0].AdaptationSet ?? [],
}

const EVENT_STREAM: RemoteElementKind<EventStreamType> = {
    wrap: (fragment) => mpdWrapper(`<Period>${fragment}</Period>`),
    extract: (mpd) => mpd.Period[0].EventStream ?? [],
}

const SEGMENT_LIST: RemoteElementKind<SegmentListType> = {
    wrap: (fragment) =>
        mpdWrapper(
            `<Period><AdaptationSet><Representation id="" bandwidth="0">${fragment}</Representation></AdaptationSet></Period>`
        ),
    extract: (mpd) => {
        const segmentList =
            mpd.Period[0].AdaptationSet![0].Representation![0].SegmentList
        return segmentList ? [segmentList] : []
    },
}

interface Linkable {
    readonly href?: string
}

/**
 * Resolves an element's remote link, returning the elements that replace it:
 * the resolved fragment's elements (themselves resolved), none for
 * resolve-to-zero, or the element without its link when resolution fails.
 */
async function resolveRemote<T extends Linkable>(
    fetchText: FetchText,
    kind: RemoteElementKind<T>,
    element: T,
    baseUrl: string,
    depth: number
): Promise<T[]> {
    const href = element.href
    if (!href) return [element]
    if (href === XLINK_RESOLVE_TO_ZERO) return []
    try {
        if (depth >= MAX_LINK_DEPTH)
            throw new Error(`remote element depth exceeds ${MAX_LINK_DEPTH}`)
        const response = await fetchText(resolveUrl(href, baseUrl))
        const fragment = response.text.replace(/^\s*<\?xml[^>]*\?>/, '')
        const resolved = kind.extract(
            parseDashManifest(kind.wrap(fragment)).MPD
        )
        const nested = await Promise.all(
            resolved.map((child) =>
                resolveRemote(fetchText, kind, child, response.url, depth + 1)
            )
        )
        return nested.flat()
    } catch (error) {
        logWarn(logTarget, `remote element ${href} failed to resolve`, error)
        const unlinked = element as Mutable<T>
        delete unlinked.href
        return kind.isValid?.(unlinked) === false ? [] : [unlinked]
    }
}

/**
 * Resolves the remote elements within the MPD, depth first.
 */
async function resolveRemoteChildren(
    fetchText: FetchText,
    mpd: Mutable<MPDtype>,
    baseUrl: string,
    depth: number
): Promise<void> {
    const periods = (
        await Promise.all(
            mpd.Period.map((period) =>
                resolveRemote(fetchText, PERIOD, period, baseUrl, depth)
            )
        )
    ).flat()
    await Promise.all(
        periods.map(async (period) => {
            const p = period as Mutable<PeriodType>
            p.parent = mpd
            if (p.EventStream) {
                p.EventStream = (
                    await Promise.all(
                        p.EventStream.map((eventStream) =>
                            resolveRemote(
                                fetchText,
                                EVENT_STREAM,
                                eventStream,
                                baseUrl,
                                depth
                            )
                        )
                    )
                ).flat()
            }
            await resolveSegmentList(fetchText, p, baseUrl, depth)
            if (!p.AdaptationSet) return
            p.AdaptationSet = (
                await Promise.all(
                    p.AdaptationSet.map((adaptationSet) =>
                        resolveRemote(
                            fetchText,
                            ADAPTATION_SET,
                            adaptationSet,
                            baseUrl,
                            depth
                        )
                    )
                )
            ).flat()
            await Promise.all(
                p.AdaptationSet.map(async (adaptationSet) => {
                    const a = adaptationSet as Mutable<AdaptationSetType>
                    a.parent = p
                    await resolveSegmentList(fetchText, a, baseUrl, depth)
                    await Promise.all(
                        (a.Representation ?? []).map(async (representation) => {
                            const r =
                                representation as Mutable<RepresentationType>
                            r.parent = a
                            await resolveSegmentList(
                                fetchText,
                                r,
                                baseUrl,
                                depth
                            )
                        })
                    )
                })
            )
        })
    )
    mpd.Period = periods
}

async function resolveSegmentList(
    fetchText: FetchText,
    owner: { SegmentList?: SegmentListType },
    baseUrl: string,
    depth: number
): Promise<void> {
    const segmentList = owner.SegmentList
    if (!segmentList?.href) return
    const resolved = (
        await resolveRemote(
            fetchText,
            SEGMENT_LIST,
            segmentList,
            baseUrl,
            depth
        )
    ).at(0)
    if (resolved) owner.SegmentList = resolved
    else delete owner.SegmentList
}
