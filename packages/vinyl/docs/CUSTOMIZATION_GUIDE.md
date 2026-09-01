# Customization Guide (Advanced)

Amazon Vinyl exposes several extension points that let an application filter,
sort, or otherwise reshape playback without forking the player. The extension
points are stacked from the most general to the most specific:

1. **Media timeline transform** — protocol-agnostic filtering and shaping of the
   qualities the ABR selector may pick from.
2. **DASH manifest transform** — DASH-specific filtering, sorting, and
   restructuring of the parsed manifest.
3. **HLS manifest transform** — HLS-specific filtering and sorting of the parsed
   master playlist.
4. **Parser rule extensions** — parse additional XML elements/attributes on top
   of the default DASH parser rules (or the HLS parser hooks), for custom
   `ContentProtection` children, supplemental descriptors, etc.

Start at the highest layer that solves your problem. Timeline-level filtering is
protocol-agnostic and applies to both DASH and HLS.

---

## 1. Media timeline transform (protocol-agnostic)

The `MediaTimeline` is the last layer before the ABR selector sees the stream: a
list of `MediaPeriod`s, each with a set of `MediaQualityData` entries carrying
`MediaQualityMetadata` (mime type, codecs, bandwidth, resolution, language,
content protections, characteristics, …). Filtering here is the recommended
place for anything that doesn't need to look at the raw manifest, because it
works identically for DASH and HLS.

Vinyl ships `createDefaultMediaTimelineTransformer`, which chains codec/mime
support, DRM key-system support, sample-rate support, audio-description gating,
and language preference. Applications can stack their own filters over the same
primitives.

### Filter timeline qualities

```typescript
import {
    createVinylPlayer,
    filterTimelineQualities,
    createDefaultMediaTimelineTransformer,
    type MediaTimeline,
    type MediaQualityMetadata,
} from '@amazon/vinyl'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

/** Drop everything over 2 Mbps. */
function dropHighBitrate(timeline: MediaTimeline): MediaTimeline {
    return filterTimelineQualities(
        (quality: MediaQualityMetadata) => quality.bandwidth <= 2_000_000,
        () => {
            throw new MediaUnsupportedError(
                'No qualities within bitrate cap',
                'bitrate-cap'
            )
        },
        timeline
    )
}

const player = createVinylPlayer(
    { media: new Audio() },
    {
        // Override the timeline transformer factory to chain the extra filter
        // on top of the default one.
        createMediaTimelineTransformer: (deps) => {
            const defaults = createDefaultMediaTimelineTransformer(deps)
            return defaults.map(async (t) => dropHighBitrate(await t))
        },
    }
)
```

> **Note:** A plain bitrate cap already has a built-in configuration value —
> `player.configure({ abr: { maxBandwidth: 2_000_000 } })` — and resolution caps
> map to `abr.maxHeight` / `abr.maxWidth`. The filter above is shown only to
> illustrate the mechanism; reach for a custom timeline filter when you need
> logic the built-in ABR restrictions don't cover.

`filterTimelineQualitiesAsync` is available for filters that need to await (e.g.
an EME key-system probe). Both throw via the callback when a period ends up
empty, so callers can surface a specific error.

---

## 2. DASH manifest transform

Applications that need to look at raw DASH elements (adaptation-set switching
groups, per-representation descriptors, essential/supplemental properties) work
at this layer. The manifest transformer is a factory over
`ObservableValue<Promise<DashManifestData>>`, so multiple transformers compose.

Vinyl's default (`createDefaultDashManifestTransformer`) sorts adaptation sets
by descending `selectionPriority` and representations by ascending
`qualityRanking` then descending `bandwidth`. Filtering utilities
(`filterDashRepresentations`, `filterDashAdaptationSets`,
`sortDashRepresentations`, `sortDashAdaptationSets`) return cloned manifests, so
composition is safe.

### Add a representation filter

```typescript
import {
    createDefaultDashManifestTransformer,
    createVinylPlayer,
    filterDashRepresentations,
    mapManifestTransform,
    type DashManifest,
} from '@amazon/vinyl'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

/** Drop stereo-plus channel counts (headphones-only build). */
function stereoOnly(manifest: DashManifest): DashManifest {
    return filterDashRepresentations(
        (rep) =>
            !rep.AudioChannelConfiguration ||
            Number(rep.AudioChannelConfiguration.value) <= 2,
        () => {
            throw new MediaUnsupportedError(
                'Only stereo audio supported',
                'stereo-only'
            )
        },
        manifest
    )
}

const player = createVinylPlayer(
    { media: new Audio() },
    {
        createDashFactories: (options) => (deps) => (loadOptions) => {
            const base = deps.createDashFactories(options)(deps)(loadOptions)
            return {
                ...base,
                manifestTransformed: (transformDeps) =>
                    mapManifestTransform(
                        createDefaultDashManifestTransformer(transformDeps),
                        stereoOnly
                    ),
            }
        },
    }
)
```

Filters can pull in additional reactive inputs (a config observable, a network
class, etc.) by mapping over `combineData({ manifestController, config })`
instead of `mapManifestTransform`.

---

## 3. HLS manifest transform

The HLS layer is smaller than DASH — one master playlist with a list of
variants, media playlists loaded lazily by the selected variant.
`createDefaultHlsManifestTransformer` sorts variants by descending bandwidth.
Extend it the same way as DASH by overriding the `manifestTransformed` slot on
the HLS factories.

```typescript
import {
    createDefaultHlsManifestTransformer,
    createVinylPlayer,
    type HlsManifestData,
} from '@amazon/vinyl'

/** Drop every variant over 720p. */
function cap720p(data: HlsManifestData): HlsManifestData {
    const variants = data.mainPlaylist.variants.filter(
        (v) => !v.resolution || v.resolution.height <= 720
    )
    return {
        ...data,
        mainPlaylist: { ...data.mainPlaylist, variants },
    }
}

const player = createVinylPlayer(
    { media: new Audio() },
    {
        createHlsFactories: (options) => (deps) => (loadOptions) => {
            const base = deps.createHlsFactories(options)(deps)(loadOptions)
            return {
                ...base,
                manifestTransformed: (transformDeps) =>
                    createDefaultHlsManifestTransformer(transformDeps).map(
                        async (v) => cap720p(await v)
                    ),
            }
        },
    }
)
```

> **Note:** A resolution cap like the one above also has a built-in
> configuration value — `player.configure({ abr: { maxHeight: 720 } })`. The
> filter is shown only to illustrate the mechanism.

Cross-cutting quality filtering (bandwidth caps, codec support, language
preference) belongs at the timeline layer above; this layer is for HLS-specific
shape (e.g. dropping variants by an HLS-only attribute the ABR restrictions
don't model).

---

## 4. Parser rule extensions

Vinyl's DASH parser is rule-based. The `dashDrmRules` ruleset (default DASH
manifest rules + cenc + PlayReady content-protection extensions) is exported so
consumers can layer additional element/attribute rules on top of it without
reimplementing anything.

### Parse a custom `ContentProtection` child

Consider a manifest that carries a vendor-specific `<LicenseUrl>` element inside
each `ContentProtection`, under its own namespace:

```xml
<ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"
                   xmlns:ext="urn:example:drm:2020">
    <cenc:pssh>...</cenc:pssh>
    <ext:LicenseUrl>https://example.com/getLicense</ext:LicenseUrl>
</ContentProtection>
```

Define a rule for the new element, merge it in, and build a parser:

```typescript
import {
    charactersString,
    createDashProtectionXmlRules,
    dashDrmRules,
    element,
    mapXmlRules,
    mergeXmlRules,
    parseXml,
    ParseXmlHandlerImpl,
    type XmlRules,
} from '@amazon/vinyl-mpd-parser'

const NS = 'urn:example:drm:2020'

interface LicenseUrlProtection {
    readonly LicenseUrl?: { readonly _content: string }
}

const licenseUrlRules: XmlRules<LicenseUrlProtection> = {
    LicenseUrl: element({ _content: charactersString }, { namespaceUri: NS }),
}

const rules = mapXmlRules(
    mergeXmlRules(dashDrmRules, createDashProtectionXmlRules(licenseUrlRules))
)

export function parseDashManifestWithLicenseUrl(xml: string) {
    return parseXml(xml, new ParseXmlHandlerImpl(rules))
}
```

Feed the extended parser into a track via a custom `manifestProvider`:

```typescript
player.load({
    type: 'dash',
    uri: manifestUrl,
    manifestProvider: async () => {
        const response = await fetch(manifestUrl)
        return {
            manifest: parseDashManifestWithLicenseUrl(await response.text()),
            baseUrl: manifestUrl,
        }
    },
    // …bind license-server providers that read the parsed LicenseUrl from the
    // matching ContentProtection element.
})
```

`createDashProtectionXmlRules` wires a set of `ContentProtection` child rules
into every level
(`MPD > Period > AdaptationSet > Representation > SubRepresentation`), so the
same rule automatically applies wherever `ContentProtection` may appear.

### Utility reference

- `filterTimelineQualities` / `filterTimelineQualitiesAsync` — timeline-level
  quality filter with a throw-on-empty callback.
- `filterDashRepresentations` / `filterDashAdaptationSets` — DASH element
  filters with a throw-on-empty callback.
- `sortDashRepresentations` / `sortDashAdaptationSets` — DASH sorters.
- `mapManifestTransform` — apply a
  `(DashManifest) => MaybePromise<DashManifest>` over a manifest observable,
  preserving `baseUrl`.
- `manifestIsPlayable` — check whether a filtered DASH manifest still has
  playable representations.
- `dashDrmRules` (from `@amazon/vinyl-mpd-parser`) — default DASH manifest +
  cenc + PlayReady rules, ready to merge additional rules onto.
- `createDashProtectionXmlRules` — lifts a `ContentProtection` child rule to
  every place `ContentProtection` may appear.

## Guidelines

1. **Pick the highest layer that fits.** Timeline filters are DASH/HLS-neutral
   and cheapest to write.
2. **Give every filter a distinct error code** so surfaced errors are
   attributable.
3. **Sync filters are preferred**; only use async filters for genuinely
   asynchronous checks (e.g. EME probes).
4. **Filter utilities clone.** You can chain them freely without worrying about
   mutating shared state.
