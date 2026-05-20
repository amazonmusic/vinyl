## Shared Build Utilities

Reusable build utility for Amazon Vinyl and Amazon Vinyl-related TypeScript
libraries.

## Packages

### util

General utilities for build scripts and configuration.

### vinyl

Amazon Vinyl defaults for the provided tools.

### typescript

Utilities for compiling and running TypeScript code.

## Build Tools

### ESBuild (https://esbuild.github.io/)

ESBuild provides an exceptionally fast typescript build system that provides
simple hooks where we can add our custom plugins. This allows us to run babel
transpilation, replace path aliases, and emit type declarations after file
changes were detected.

### Babel (https://babeljs.io/)

Babel is a transpiler for js or ts that produces highly-compatible applications
or libraries.

The compatibility targets are defined in the package.json "browserslist"
property. Use https://browsersl.ist/ to generate the expression for
compatibility targets.

### BrowserStack

We use the BrowserStack service to run integration and unit tests on real
browsers and devices. It allows us to set a compatibility matrix which we can
assert that all functionality for our playback engine works as expected for
every supported platform.

[BrowserStack Readme](./src/browserstack/README.md)

### Express

Express is an HTTP server which supports SSL, proxies, and REST apis.
