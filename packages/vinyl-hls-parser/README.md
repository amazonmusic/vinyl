# @amazon/vinyl-hls-parser

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-hls-parser.svg)](https://www.npmjs.com/package/@amazon/vinyl-hls-parser)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-hls-parser.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-hls-parser)

A small, fast HLS playlist parser for browser and Node. Produces typed objects
for both the multivariant (main) playlist and the per-rendition media playlist.
Zero runtime dependencies.

## Install

```shell
npm install @amazon/vinyl-hls-parser
```

## Usage

```typescript
import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'

const main = parseMainPlaylist(await (await fetch(mainUri)).text())
const variant = main.variants[0]

const media = parseMediaPlaylist(await (await fetch(variant.uri)).text())

for (const segment of media.segments) {
    console.log(segment.uri, segment.duration)
}
```

`parseMediaPlaylist` accepts an optional second argument with HLS
variable-substitution values for playlists using `{$NAME}` interpolation.

## License

Apache-2.0
