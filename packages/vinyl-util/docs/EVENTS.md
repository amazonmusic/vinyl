# Events

Amazon Vinyl uses a statically-typed observer pattern. Event hosts describe the
events they emit using an event map type. Observers may subscribe to those
events, and unsubscribe using the returned unsubscribe handles.

An event host is not tied to the DOM, it may be used anywhere an observer
pattern is needed and will work in both Node and Browser environments.

## Usage

To subscribe to an event from an event host, use the `on` function, which
returns a function that, when invoked, removes the listener.

## Example:

```typescript
import { EventHostImpl } from '@amazon/vinyl-util'

export type CountEvent = {
    readonly value: number
}

export type CounterEventMap = {
    readonly count: CountEvent
}

export class Counter extends EventHostImpl<CounterEventMap> {
    private _count = 0

    increment() {
        this._count++
        this.dispatch('count', { value: this._count })
    }
}

const counter = new Counter()
const sub = counter.on('count', (event) => {
    console.log('count event:', event.value)
})

counter.increment() // count event: 1
counter.increment() // count event: 2
counter.increment() // count event: 3

sub() // remove listener

counter.increment() // event not observed
```

## Once Listeners

```typescript
const counter = new Counter()
counter.on(
    'count',
    (event) => {
        console.log('count event:', event.count)
    },
    { once: true }
)

counter.increment() // count event: 1
counter.increment() // event not observed
```

## ReadonlyEventHost

When typing interfaces, `ReadonlyEventHost<T>` may be used to expose a readonly
interface to observers. This allows event maps to have correct variance and
enable TypeScript to ensure events are not incorrectly dispatched from outside
systems.

## Cleanup

When an event host is disposed, all listeners will be removed. To ensure good
garbage collection, follow an ownership principle. When adding listeners to a
provided dependency, added listeners must be paired with an unsubscribe.

## EventTarget

EventTarget objects may be wrapped using `DomEventHost`. Using DomEventHost
allows applications to use a consistent observer pattern, shared utilities, and
easier cleanup.

TypeScript provides event map types that may be used to statically type an
EventTarget's events.

```typescript
import { DomEventHost } from '@amazon/vinyl-util'

const div = document.querySelector('div')
const divEvents = new DomEventHost<HTMLElementEventMap>(div)

divEvents.on('click', (event) => console.log('clicked'))
```

When subscribing to a DomEventHost, additional options are available such as
'passive', or 'capture'.

```typescript
divEvents.on('wheel', (event) => console.log('wheel'), {
    passive: true,
    capture: true,
})
```

Note: The event option 'signal' is not supported, to unsubscribe to many
handlers at once, create a disposer.

E.g.

```typescript
import { createDisposer } from '@amazon/vinyl-util'

const { add, dispose } = createDisposer()

add(divEvents.on('click', (event) => console.log('click')))
add(divEvents.on('wheel', (event) => console.log('wheel')))

dispose() // removes all handlers added
```

## Redispatching Events

To redispatch events, use the `redispatchEvents` utility method.

Example:

```typescript
import { EventHostImpl } from '@amazon/vinyl-util'

class MyWrapper extends EventHostImpl<HTMLElementEventMap> {
    private readonly divEvents = new DomEventHost<HTMLElementEventMap>(div)

    constructor() {
        super()
        redispatchEvents(this, this.divEvents, [
            'click',
            'mouseMove',
            'touchStart',
            'touchEnd',
        ])
    }
}
```

## Extending EventHost Implementations

To extend an EventHost implementation, adding new events to a subclass, certain
functions on EventHostImpl must be overridden.

_note_ This scenario is in need of improvement. To ensure full static checking
for events and event types, method overrides when extending EventHostImpl is
necessary, however the ergonomics can be improved.

```typescript
import type { EmptyObject, EventHost } from '@amazon/vinyl-util'

export type CounterWithResetEventMap = CounterEventMap & {
    readonly reset: EmptyObject
}

class CounterWithReset
    extends Counter
    implements EventHost<CounterWithResetEventMap>
{
    hasListeners(type: keyof CounterWithResetEventMap): boolean {
        return super.hasListeners(type as any)
    }

    on<K extends keyof CounterWithResetEventMap>(
        type: K,
        handler: EventHandler<CounterWithResetEventMap[K]>,
        options?: SignalOptions
    ): Unsubscribe {
        return super.on(type as any, handler, options)
    }

    dispatch<K extends keyof CounterWithResetEventMap>(
        type: K,
        event: CounterWithResetEventMap[K]
    ) {
        super.dispatch(type as any, event)
    }
}
```
