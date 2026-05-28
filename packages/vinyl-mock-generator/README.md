# @amazon/vinyl-mock-generator

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-mock-generator.svg)](https://www.npmjs.com/package/@amazon/vinyl-mock-generator)

A TypeScript-driven mock class generator. Reads a library's `.d.ts` files
through the TypeScript compiler API and emits a `Mock<Name>` implementation for
every interface, with sensible default property values and customizable spy
methods. Used to keep test doubles in sync with library types as they evolve.

## Install

```shell
npm install --save-dev @amazon/vinyl-mock-generator
```

## Usage

Build a script that calls `generateMocks` with the library's entry points and
your spy convention. The result is a single file you check in next to your
tests:

```typescript
import { generateMocks } from '@amazon/vinyl-mock-generator'

generateMocks({
    library: '@amazon/vinyl',
    rootNames: ['index.d.ts'],
    outFile: './test/generated/mocks.ts',
    header: `import { spy } from './spyHelper'\n\n`,
    createSpyMethod: (_iface, method) =>
        `    ${method.name} = spy('${method.name}')`,
})
```

`interfaceFilter` can narrow which interfaces are emitted, and
`initializeMockClass` lets you inject extra constructor logic.

See the player docs at
[amazonmusic.github.io/vinyl](https://amazonmusic.github.io/vinyl).

## License

Apache-2.0
