# @amazon/vinyl-build-utils

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-build-utils.svg)](https://www.npmjs.com/package/@amazon/vinyl-build-utils)

Reusable build utilities used to build Amazon Vinyl and related TypeScript
libraries.

## Modules

### `util`

General utilities for build scripts and configuration.

### `vinyl`

Amazon Vinyl defaults for the provided tools.

### `typescript`

Utilities for compiling and running TypeScript code.

## Build Tools

### [ESBuild](https://esbuild.github.io/)

ESBuild provides an exceptionally fast TypeScript build with simple plugin
hooks. We use it to run Babel transpilation, replace path aliases, and emit type
declarations after file changes are detected.

### [Babel](https://babeljs.io/)

Babel is a transpiler for JS or TS that produces highly compatible applications
or libraries. Compatibility targets are defined in the package.json
`browserslist` property — use [browsersl.ist](https://browsersl.ist/) to
generate the expression.

### BrowserStack

We use BrowserStack to run integration and unit tests on real browsers and
devices. See the [BrowserStack runner](./src/browserstack/README.md) for the
runner contract and a usage example.

### Express

Express is the HTTP server used for the local test server (SSL, proxies, REST
APIs).

## License

Apache-2.0
