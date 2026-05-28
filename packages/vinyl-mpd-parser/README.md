# @amazon/vinyl-mpd-parser

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-mpd-parser.svg)](https://www.npmjs.com/package/@amazon/vinyl-mpd-parser)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-mpd-parser.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-mpd-parser)

A fast, schema-validated DASH manifest parser for browser and Node. Parses
`.mpd` documents into a typed object that mirrors the MPEG-DASH 2011 schema,
with built-in support for the `cenc` and Microsoft PlayReady content protection
namespaces. Validates against the schema as it parses, surfacing the exact
source location for invalid documents.

## Install

```shell
npm install @amazon/vinyl-mpd-parser
```

## Usage

```typescript
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'

const text = await (await fetch(mpdUri)).text()
const manifest = parseDashManifest(text)

for (const period of manifest.MPD.Period) {
    for (const adaptationSet of period.AdaptationSet ?? []) {
        console.log(adaptationSet.contentType, adaptationSet.Representation)
    }
}
```

The parser is built on top of [`@amazon/vinyl-xml`](../vinyl-xml). To extend the
rule set with additional namespaces, merge your own `XmlRules` into the parser
following the same pattern used internally for content protection.

## License

Apache-2.0
