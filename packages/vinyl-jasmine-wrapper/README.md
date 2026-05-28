# @amazon/vinyl-jasmine-wrapper

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-jasmine-wrapper.svg)](https://www.npmjs.com/package/@amazon/vinyl-jasmine-wrapper)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-jasmine-wrapper.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-jasmine-wrapper)

A browser-friendly bundling of `jasmine-core` for the HTML runner. Pulls in the
boot scripts and a small set of polyfills so the runner boots on legacy browsers
(Chrome 52+, Firefox 52+, Edge 18+, Safari 8+) where `jasmine-core`'s
ESM/Node-targeted artifacts otherwise wouldn't load.

## Install

```shell
npm install --save-dev @amazon/vinyl-jasmine-wrapper
```

## Usage

Bundle the wrapper with your tests and load the result alongside Jasmine's HTML
reporter assets:

```typescript
import '@amazon/vinyl-jasmine-wrapper'

// then import your specs
import './specs/myComponent.test'
```

The wrapper sets `jasmine.DEFAULT_TIMEOUT_INTERVAL` to 15s to give the test web
server time to start before the first spec runs.

See the player docs at
[amazonmusic.github.io/vinyl](https://amazonmusic.github.io/vinyl).

## License

Apache-2.0
