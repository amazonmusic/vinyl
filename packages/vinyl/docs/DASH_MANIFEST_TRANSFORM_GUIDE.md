# DASH Manifest Transform Extension Guide (Advanced)

This guide explains how to extend or modify DASH manifest transformations in
Amazon Vinyl.

## Overview

DASH manifest transformers sort and modify DASH manifests before playback. The
system uses a functional architecture where transformers are composable
functions over `ObservableValue<Promise<DashManifestData>>`.

Quality filtering (MIME type, key system, sample rate) is handled separately by
the media timeline transformer, not the manifest transformer. The manifest
transformer focuses on structural sorting and representation-level filtering.

## Default Implementation

`createDefaultDashManifestTransformer()` sorts:

- Adaptation sets by `selectionPriority` (descending)
- Representations by `qualityRanking` (ascending), then `bandwidth` (descending)

The result is mapped over the manifest controller observable.

## Creating Custom Filters

### Representation Filters

Filter representations based on properties like bandwidth:

```typescript
import { filterDashRepresentations, mapManifestTransform } from '@amazon/vinyl'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

function filterHighBitrate(manifest: DashManifest) {
    return filterDashRepresentations(
        (representation) => representation.bandwidth <= 1_000_000,
        () => {
            throw new MediaUnsupportedError(
                'No representations within bitrate range',
                'bitrate_filter'
            )
        },
        manifest
    )
}
```

### Adaptation Set Filters

Filter entire adaptation sets:

```typescript
import { filterDashAdaptationSets } from '@amazon/vinyl'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

function filterVideoOnly(manifest: DashManifest) {
    return filterDashAdaptationSets(
        (adaptationSet) =>
            adaptationSet.mimeType?.startsWith('video/') ?? false,
        () => {
            throw new MediaUnsupportedError(
                'No video adaptation sets found',
                'video_only'
            )
        },
        manifest
    )
}
```

## Creating Custom Transformers

### Transform Function

Use `flowAsync` to compose multiple filter/sort steps, and
`mapManifestTransform` to apply them over a manifest observable:

```typescript
import {
    filterDashRepresentations,
    sortDashRepresentations,
    mapManifestTransform,
} from '@amazon/vinyl'
import { flowAsync } from '@amazon/vinyl-util'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { DashManifestData } from '@amazon/vinyl'

function createCustomTransformer(
    manifestController: ObservableValue<Promise<DashManifestData>>
) {
    const transformManifest = flowAsync(
        (m) => filterDashRepresentations(customPredicate, throwCustomError, m),
        (m) => sortDashRepresentations(customComparator, m)
    )

    return mapManifestTransform(manifestController, transformManifest)
}
```

### Filter Factory

Transformers are factory functions with the signature
`(ObservableValue<Promise<DashManifestData>>) => ObservableValue<Promise<DashManifestData>>`.
This allows composition with `flow`:

```typescript
import { mapManifestTransform, filterDashRepresentations } from '@amazon/vinyl'

function createCustomFilter(deps: CustomDeps) {
    return (
        manifestController: ObservableValue<Promise<DashManifestData>>
    ): ObservableValue<Promise<DashManifestData>> =>
        mapManifestTransform(manifestController, (manifest) =>
            filterDashRepresentations(
                (rep) => customPredicate(deps, rep),
                throwCustomError,
                manifest
            )
        )
}
```

For filters that depend on additional reactive inputs, use `combineData`:

```typescript
import { combineData } from '@amazon/vinyl-observable'
import { filterDashRepresentations } from '@amazon/vinyl'

function createConfigFilter(deps: {
    readonly configProvider: ObservableValue<FilterConfig>
}): (
    manifestAndPath: ObservableValue<Promise<DashManifestData>>
) => ObservableValue<Promise<DashManifestData>> {
    return (manifestAndPath) =>
        combineData({
            manifestAndPath,
            config: deps.configProvider,
        }).map(async ({ manifestAndPath, config }) => {
            const { manifest, baseUrl } = await manifestAndPath
            return {
                baseUrl,
                manifest: filterDashRepresentations(
                    (rep) => rep.bandwidth <= config.maxBitrate,
                    throwConfigFilterError,
                    manifest
                ),
            }
        })
}
```

### Composing Transformers with flow

```typescript
import { flow } from '@amazon/vinyl-util'

function createMyManifestTransformer(
    deps: MyTransformerDeps
): ObservableValue<Promise<DashManifestData>> {
    return flow(
        createCustomFilter(deps),
        createSortTransformer()
    )(createDefaultDashManifestTransformer(deps))
}
```

## Integration with createVinylPlayer

Override the `manifestTransformed` factory to inject custom transformations
after the default sorting:

```typescript
import {
    createVinylPlayer,
    createDefaultDashManifestTransformer,
    createDashFactories,
    filterDashRepresentations,
    mapManifestTransform,
    type DashManifestTransformerDeps,
} from '@amazon/vinyl'
import { flowAsync } from '@amazon/vinyl-util'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

function filterStereoOnly(manifest: DashManifest) {
    return filterDashRepresentations(
        (rep) =>
            !rep.AudioChannelConfiguration ||
            Number(rep.AudioChannelConfiguration.value) <= 2,
        () => {
            throw new MediaUnsupportedError(
                'Only stereo audio supported',
                'stereo_only'
            )
        },
        manifest
    )
}

const player = createVinylPlayer(
    { media: new Audio() },
    {
        createDashFactories: (options) => (deps) => (loadOptions) => ({
            ...createDashFactories(options)(deps)(loadOptions),
            manifestTransformed: (
                transformDeps: DashManifestTransformerDeps
            ) => {
                const transformManifest = flowAsync(filterStereoOnly)

                return mapManifestTransform(
                    createDefaultDashManifestTransformer(transformDeps),
                    transformManifest
                )
            },
        }),
    }
)
```

## Utility Functions

- `filterDashAdaptationSets()` - Filter adaptation sets with error handling
- `filterDashRepresentations()` - Filter representations with error handling
- `sortDashAdaptationSets()` - Sort adaptation sets by comparator
- `sortDashRepresentations()` - Sort representations by comparator
- `manifestIsPlayable()` - Check if manifest has playable content
- `mapManifestTransform()` - Apply a
  `(DashManifest) => MaybePromise<DashManifest>` over a manifest observable,
  preserving baseUrl

## Best Practices

1. **Error Handling**: Always provide meaningful error codes and messages
2. **Performance**: Use async filters only for expensive operations (e.g. DRM)
3. **Composition**: Prefer small, focused filter factories composed with `flow`
4. **Immutability**: Filter utilities clone manifests internally
