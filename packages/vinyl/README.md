# @amazon/vinyl

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl.svg)](https://www.npmjs.com/package/@amazon/vinyl)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl)

An HTML5 playback engine for DASH and HLS streaming with first-class TypeScript
support, zero runtime dependencies, and adaptive bitrate, prefetching, and
gapless playback built in.

## Install

```shell
npm install @amazon/vinyl
```

## Quick Start

```typescript
import { createVinylPlayer } from '@amazon/vinyl'

const media = new Audio()
media.controls = true
document.body.appendChild(media)

const player = createVinylPlayer({ media })
player.load({
    type: 'dash',
    uri: 'https://example.com/manifest.mpd',
})
```

## Documentation

- [Usage Guide](./docs/USAGE.md) — installation, loading tracks, queueing,
  prefetching, and configuration.
- [Architecture](./docs/ARCHITECTURE.md) — pipeline, controllers, and
  extensibility.
- [DRM Configuration](./docs/DRM_CONFIGURATION.md) — Widevine, FairPlay, and
  PlayReady setup.
- [DRM Controller](./docs/DRM_CONTROLLER.md) — implementing custom license
  acquisition.
- [DASH Manifest Transforms](./docs/DASH_MANIFEST_TRANSFORM_GUIDE.md) —
  rewriting manifests before parsing.
- [Auto Reset](./docs/AUTO_RESET.md) — recovering from terminal playback errors.

Browse the full docs and TypeDoc API reference at
[amazonmusic.github.io/vinyl](https://amazonmusic.github.io/vinyl).

## License

Apache-2.0
