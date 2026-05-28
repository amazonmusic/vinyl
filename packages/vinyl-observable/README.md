# @amazon/vinyl-observable

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-observable.svg)](https://www.npmjs.com/package/@amazon/vinyl-observable)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-observable.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-observable)

A small, typed observable value primitive for state tracking without a
third-party reactivity system. Under 1 KiB minified + gzipped.

## Install

```shell
npm install @amazon/vinyl-observable
```

## ObservableValue\<T>

An `ObservableValue<T>` represents a reactive, read-only data container that can
be observed for changes over time.

### Key Features

- Reactive: subscribers are notified on value changes.
- Composable: derive new observable values using `map` and `pick`.
- Typed: strong type safety for both value and callback arguments.
- Lightweight: minified and gzipped bundle size is under 1 KiB.

### Example

Use `data` to create a `MutableValue` for a data type.

```typescript
import { data } from '@amazon/vinyl-observable'

const user$ = data({ name: 'Alice', age: 30 })

const name$ = user$.pick('name')
name$.onData((name) => {
    console.log('Name changed:', name)
})

user$.value = { name: 'Bob', age: 30 }
// Logs: "Name changed: Bob"

const age$ = user$.pick('age')
age$.value = 31

user$.value.age // 31
```

## Utilities

### combineData

Combines multiple data providers into a single record, notifying observers when
any have changed.

```typescript
import { combineData, data } from '@amazon/vinyl-observable'

const a = data(1)
const b = data('x')
const combined = combineData({ a, b })

combined.onValue((v) => {
    console.log('changed: ', v.a, v.b)
})

a.value = 2
// Logs: "changed: 2 x"
b.value = 'y'
// Logs: "changed: 2 y"
```

The `combined` `onValue` callback is invoked synchronously; every change from
every sub-provider is delivered. See `throttle` in
[`@amazon/vinyl-util`](../vinyl-util) to handle frequent changes.

### externalData

Creates an `ObservableValue` that integrates with an external data source. Data
is only actively fetched or listened to when a subscriber calls `onData`,
allowing lazy subscription to external event systems such as WebSocket, polling,
or other push-based updates.

Returns an `ObservableValue<T>` that:

- Emits `initialValue` immediately on subscription.
- Receives future values from `onDataRequested`.
- Automatically unsubscribes from the external source when no listeners remain.

```typescript
import { externalData } from '@amazon/vinyl-observable'

const timeData = externalData<Date>(new Date(), (setData) => {
    const interval = setInterval(() => {
        setData(new Date())
    }, 1000)

    return () => clearInterval(interval)
})

const unsubscribe = timeData.onData((now) => {
    console.log('Current time:', now)
})

// Later, to stop receiving updates
unsubscribe()
```

## License

Apache-2.0
