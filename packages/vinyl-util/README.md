# @amazon/vinyl-util

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-util.svg)](https://www.npmjs.com/package/@amazon/vinyl-util)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-util.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-util)

Standard utilities shared across Amazon Vinyl packages: a typed event-host
abstraction, a global registry for swappable references, a Fetch wrapper with
retry/backoff and metrics, and a small grab-bag of disposers, validation errors,
and async helpers. Works in browser and Node, zero runtime dependencies.

## Install

```shell
npm install @amazon/vinyl-util
```

## Documentation

- [Events](./docs/EVENTS.md) — typed observer pattern (`EventHost`,
  `DomEventHost`), once-listeners, redispatch, cleanup.
- [Globals](./docs/GLOBALS.md) — overriding global references for testability
  and resource management.
- [Networking](./docs/NETWORKING.md) — `requesterWithRetryRef`, retry policy,
  backoff control flow, network metrics.

Browse all docs and the TypeDoc API reference at
[amazonmusic.github.io/vinyl](https://amazonmusic.github.io/vinyl).

## License

Apache-2.0
