# Observable

# ObservableValue\<T>

An `ObservableValue<T>` represents a reactive, read-only data container that can
be observed for changes over time. It is designed for simple and efficient state
tracking without introducing third-party reactivity systems.

## Key Features

- Reactive: Subscribers are notified on value changes
- Composable: You can derive new observable values using `map` and `pick`
- Typed: Strong type safety for both value and callback arguments
- Lightweight: Minified and GZipped bundle size is under 1KiB.

## Example

Use `data` to create a MutableValue for a data type.

```typescript
const user$ = data({ name: 'Alice', age: 30 })

const name$ = user$.pick('name')
name$.onData((name) => {
    console.log('Name changed:', name)
})

user$.value = { name: 'Bob', age: 30 }
// Logs: "Name changed: Bob"

age$ = user$.pick('age')
age$.value = 31

user$.value.age // 31
```

## Utilities

### combineData

Combines multiple data providers into a single record, notifying observers when
any have changed.

```typescript
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

Note - combined onValue callback is invoked synchronously; every change from
every sub-provider will be notified to observers. See `throttle` in vinyl-util
to handle frequent changes.

## externalData

Creates an `ObservableValue` that integrates with an external data source. The
data is only actively fetched or listened to when a subscriber calls `onData`,
allowing lazy subscription to external event systems such as WebSocket, polling,
or other push-based updates.

Returns An ObservableValue<T> that:

- Emits initialValue immediately on subscription.
- Receives future values from onDataRequested.
- Automatically unsubscribes from the external source when no listeners remain.

Example:

```typescript
import { externalData } from './data'

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
