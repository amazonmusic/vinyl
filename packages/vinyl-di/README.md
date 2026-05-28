# @amazon/vinyl-di

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-di.svg)](https://www.npmjs.com/package/@amazon/vinyl-di)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-di.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-di)

Constructor-based dependency injection with a compile-time-checked dependency
graph. Used internally by Amazon Vinyl, but standalone.

## Install

```shell
npm install @amazon/vinyl-di
```

## Dependency Injection

Amazon Vinyl uses the most common form of dependency injection; requesting
dependencies through constructors.

Class constructors have a `deps` parameter describing the required dependencies.

E.g.

```typescript
/**
 * Dependencies for {@link RequesterImpl}
 */
export type RequesterImplDeps = {
    readonly networkState: NetworkState
    readonly fetch: Fetch
    readonly networkMetricsController: NetworkMetricsController
}

export class RequesterImpl {
    constructor(protected readonly deps: RequesterImplDeps) {}

    // ...
}

const requester = new Requester({
    networkState: new NetworkStateImpl(),
    fetch: new FetchImpl(),
})
```

There are two steps to dependency injection: creating a record of dependency
factories, then creating a container that uses the factories to construct
implementations.

When creating a record of dependency factories, the keys match the dependency
properties, and the values are functions that produce a dependency. The factory
functions may accept a single argument indicating any dependencies required for
the implementation. Wrap the record in a call to `validateFactories` which is a
compile-time-only check that ensures the dependency graph is sound. That is,
there are no cyclic dependencies, missing dependencies, or incompatible types.

Example:

```typescript
import { validateFactories } from '@amazon/vinyl-di'

class A {}

type BDependencies = {
    readonly a: A
}

class B {
    constructor(deps: BDependencies) {}
}

type CDependencies = {
    readonly a: A
    readonly b: B
}

class C {
    constructor(deps: CDependencies) {}
}

const factories = validateFactories({
    a: () => new A(),
    b: (deps: BDependencies) => new B(deps),
    c: (deps: CDependencies) => new C(deps),
} as const)
```

These factories will be used to create implementations. Use `createContainer` to
create a container that may be disposed and provides an object with getters to
lazily construct implementations from the provided factories.

```typescript
import { createContainer } from '@amazon/vinyl-di'
import { createDisposer } from '@amazon/vinyl-util'

const { add, dispose } = createDisposer()

const deps = add(createContainer(factories)).dependencies

deps.a // A {}
deps.b // B {}
deps.c // C {}
```

## External Dependencies

Sometimes you need to inject existing instances into a dependency container
without transferring ownership. Use `externalDependencies` to wrap external
dependencies that should not be disposed when the container is disposed.

```typescript
import {
    externalDependencies,
    validateFactories,
    createContainer,
} from '@amazon/vinyl-di'

// External services managed elsewhere
const logger = new Logger()
const options = { port: 8080, host: 'localhost' }

const factories = validateFactories({
    // These won't be disposed by the container
    ...externalDependencies({ logger, options }),

    // This will be disposed by the container [if Server implements Disposable]
    server: (deps: {
        readonly options: ServerOptions
        readonly logger: Logger
    }) => new Server(deps.options, deps.logger),
})

const container = createContainer(factories)

// Use dependencies normally
container.dependencies.server.start()

// Only server.dispose() is called, logger and options are left alone
container.dispose()
```

As a general guideline, when defining a dependency to be provided, the interface
requested should be the minimum API needed, and disposal should be the
responsibility of the creator.

## License

Apache-2.0
