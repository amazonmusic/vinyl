# @amazon/vinyl-cache-manager

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-cache-manager.svg)](https://www.npmjs.com/package/@amazon/vinyl-cache-manager)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-cache-manager.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-cache-manager)

A small mediator over the browser
[Cache API](https://developer.mozilla.org/docs/Web/API/Cache) that adds
HTTP-style cache-control semantics: TTLs, `stale-while-revalidate`,
`only-if-cached`, custom cache keys, and validation hooks. Designed to be shared
between the application and a service worker, with no runtime dependencies.

## Install

```shell
npm install @amazon/vinyl-cache-manager
```

## Usage

```typescript
import { CacheManager } from '@amazon/vinyl-cache-manager'

const cache = new CacheManager({ name: 'media' })

const response = await cache.get('https://example.com/segment.m4s', {
    cacheControlDefaults: { maxAge: 60 },
    cacheControlOverrides: { staleWhileRevalidate: 24 * 60 * 60 },
})
```

`cacheControlDefaults` apply when the response carries no `Cache-Control`,
`cacheControlOverrides` always win when reading from cache. POST requests can be
cached by passing an explicit `cacheKey`.

## License

Apache-2.0
