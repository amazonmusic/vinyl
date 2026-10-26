# @amazon/vinyl-tsx

[![Website](https://img.shields.io/badge/website-amazonmusic.github.io%2Fvinyl-blue)](https://amazonmusic.github.io/vinyl)
[![npm](https://img.shields.io/npm/v/@amazon/vinyl-tsx.svg)](https://www.npmjs.com/package/@amazon/vinyl-tsx)
[![size](https://img.shields.io/bundlejs/size/@amazon/vinyl-tsx.svg?label=size)](https://bundlejs.com/?q=@amazon/vinyl-tsx)

A lightweight, reactive JSX runtime for creating dynamic DOM elements with
TypeScript support. Provides a declarative way to build user interfaces with
reactive data binding via [`@amazon/vinyl-observable`](../vinyl-observable).

## Features

- **Reactive properties** — bind observable values to DOM properties that update
  automatically.
- **Hook extensions** — enhanced DOM manipulation through custom hooks (`style`,
  `visible`, `classList`).
- **Lifecycle management** — automatic cleanup and connection tracking for DOM
  elements.
- **TypeScript support** — full type safety with utility types for property
  extraction.
- **Zero dependencies** — lightweight runtime with no external framework
  dependencies.
- **Performance optimized** — efficient updates with passive event handlers and
  selective rendering.

## Install

```shell
npm install @amazon/vinyl-tsx @amazon/vinyl-util @amazon/vinyl-observable
```

## Basic Usage

### Setting up JSX

Configure your TypeScript compiler to use the vinyl-tsx JSX factory:

```json
// tsconfig.json
{
    "compilerOptions": {
        "jsx": "preserve",
        "jsxFactory": "jsx",
        "jsxFragmentFactory": "Fragment"
    }
}
```

### Creating Elements

```tsx
import { jsx } from '@amazon/vinyl-tsx'

// Basic element creation
const button = <button>Click me</button>

// With properties
const input = <input type="text" placeholder="Enter text" disabled={false} />

// With children
const container = (
    <div className="container">
        <h1>Title</h1>
        <p>Content goes here</p>
    </div>
)
```

### Children

A child can be a `Node`, a string, an observable of either, or an array of
children. Arrays, including nested arrays, are flattened, so lists don't need to
be spread:

```tsx
const items = ['One', 'Two', 'Three']

const list = (
    <ul>
        {items.map((item) => (
            <li>{item}</li>
        ))}
    </ul>
)
```

`null`, `undefined`, and `false` children are omitted and create no node, so
optional content can be written inline:

```tsx
function Greeting(props: { readonly user?: { readonly name: string } }) {
    return (
        <p>
            Hello{props.user && `, ${props.user.name}`}
            {props.user === undefined && <a href="/login">Sign in</a>}
        </p>
    )
}
```

Children are type-checked. `true`, numbers, and other values are compile errors;
convert them explicitly:

```tsx
const count = 3
const enabled = false as boolean

<p>{count}</p> // Error: number is not a valid child
<p>{String(count)}</p> // OK
<p>{enabled}</p> // Error: boolean may be true
<p>{enabled && 'Enabled'}</p> // OK
```

TypeScript widens a literal `false` written directly as a child to `boolean`, so
`<p>{false}</p>` is also an error.

### Reactive Properties

Use `@amazon/vinyl-observable` to create reactive properties that automatically
update the DOM:

```tsx
import { data } from '@amazon/vinyl-observable'
import { jsx } from '@amazon/vinyl-tsx'

const count = data(0)
const isVisible = data(true)

const counter = (
    <div>
        <span>Count: {count}</span>
        <button onclick={() => count.value++}>Increment</button>
        <button visible={isVisible}>Toggle me</button>
    </div>
)

count.value = 5 // DOM updates to show "Count: 5"
isVisible.value = false // Button becomes hidden
```

## Hook Extensions

### Style Hook

Apply CSS styles with support for both static and observable values:

```tsx
import { data } from '@amazon/vinyl-observable'

const color = data('red')
const fontSize = data('16px')

const styledDiv = (
    <div
        style={{
            color, // Observable value
            fontSize, // Observable value
            backgroundColor: 'blue', // Static value
            padding: '10px', // Static value
        }}
    >
        Styled content
    </div>
)

color.value = 'green' // Text color changes to green
```

### Visibility Hook

Control element visibility with the `visible` property:

```tsx
const isVisible = data(true)

const conditionalElement = (
    <div visible={isVisible}>This element can be hidden/shown</div>
)

isVisible.value = false // Sets display: none
isVisible.value = true // Removes display property
```

### ClassList Hook

Manage CSS classes dynamically with an array of static strings and/or observable
values:

```tsx
const theme = data<string | null>('dark')

const element = <div classList={['base-class', theme]}>Content</div>

// Element has classes: base-class dark
theme.value = 'light' // Updates to: base-class light
theme.value = null // Updates to: base-class
```

### Connection Hook

Execute code when elements are connected to or disconnected from the DOM:

```tsx
const element = (
    <div
        onConnect={(el) => {
            console.log('Element connected:', el)
            return () => {
                console.log('Element disconnected:', el)
            }
        }}
    >
        Content
    </div>
)
```

The callback receives the element typed by its tag, so element-specific APIs are
available without a cast:

```tsx
const player = <video onConnect={(el) => void el.play()} /> // el: HTMLVideoElement
```

A JSX expression itself is always typed `JSX.Element` (`HTMLElement`);
TypeScript can't type it per tag. Use `onConnect`, or call `jsx('video', {})`
directly, when you need the specific element type.

### Event Handlers

Touch and scroll events use passive listeners automatically:

```tsx
const element = (
    <div
        ontouchstart={(e) => console.log('Touch start')}
        ontouchmove={(e) => console.log('Touch move')}
        onwheel={(e) => console.log('Wheel')}
        onmousedown={(e) => console.log('Mouse down')}
    >
        Interactive content
    </div>
)
```

## Fragments

Use fragments to group elements with a wrapper `div` using `display: contents`:

```tsx
import { Fragment } from '@amazon/vinyl-tsx'

const list = (
    <Fragment>
        <li>Item 1</li>
        <li>Item 2</li>
    </Fragment>
)

const list2 = (
    <>
        <li>Item 1</li>
        <li>Item 2</li>
    </>
)
```

## Custom Components

```tsx
interface ButtonProps {
    text: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
}

function Button({ text, onClick, variant = 'primary' }: ButtonProps) {
    return (
        <button className={`btn btn-${variant}`} onclick={onClick}>
            {text}
        </button>
    )
}

const myButton = <Button text="Click me" onClick={() => alert('Clicked!')} />
```

Components receive their children as the second argument, as written, without
flattening. The type of that parameter determines which children the component
accepts in markup; a component without one accepts none:

```tsx
import { type JsxChild } from '@amazon/vinyl-tsx'

function Card(props: { readonly title: string }, children: JsxChild[]) {
    return (
        <section className="card">
            <h2>{props.title}</h2>
            {children}
        </section>
    )
}

const card = (
    <Card title="Details">
        <p>Body</p>
    </Card>
)

<Button text="Hi" onClick={() => {}}>Child</Button> // Error: Button takes no children
```

## Conditional Rendering

Unlike React, vinyl-tsx does not re-render — JSX expressions are evaluated once
at creation time. Use the `visible` hook to reactively show or hide content:

```tsx
const showDetails = data(false)

const userCard = (
    <div>
        <h3>John</h3>
        <div visible={showDetails}>
            <p>Email: john@example.com</p>
        </div>
        <button onclick={() => (showDetails.value = !showDetails.value)}>
            Toggle Details
        </button>
    </div>
)
```

## Best Practices

1. **Initialize the connected observer** once in your application to enable
   lifecycle management:

    ```tsx
    import { initializeConnectedObserver } from '@amazon/vinyl-tsx'

    const cleanup = initializeConnectedObserver()
    ```

2. **Use observables for dynamic content** — prefer observable values for
   properties that change over time.
3. **Leverage hook extensions** — `style`, `visible`, and `classList` cover most
   common DOM manipulations.
4. **Type safety** — let TypeScript check your props and children.
5. **Memory management** — observable subscriptions are cleaned up automatically
   when elements are disconnected.

## License

Apache-2.0
