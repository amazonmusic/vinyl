# TSX UI

Amazon Vinyl TSX is a lightweight, reactive JSX runtime for creating dynamic DOM
elements with TypeScript support. It provides a declarative way to build user
interfaces with reactive data binding using vinyl-observable.

## Features

- **Reactive Properties**: Bind observable values to DOM properties that update
  automatically
- **Hook Extensions**: Enhanced DOM manipulation through custom hooks (style,
  visibility, classList)
- **Lifecycle Management**: Automatic cleanup and connection tracking for DOM
  elements
- **TypeScript Support**: Full type safety with utility types for property
  extraction
- **Zero Dependencies**: Lightweight runtime with no external framework
  dependencies
- **Performance Optimized**: Efficient updates with passive event handlers and
  selective rendering

## Installation

```bash
npm install @amazon/vinyl-tsx @amazon/vinyl-util @amazon/vinyl-observable
```

## Basic Usage

### Setting up JSX

Configure your TypeScript compiler to use the vinyl-tsx JSX factory:

// tsconfig.json

```json
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

### Reactive Properties

Use vinyl-observable to create reactive properties that automatically update the
DOM:

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

// Updates automatically when observable changes
count.value = 5 // DOM updates to show "Count: 5"
isVisible.value = false // Button becomes hidden
```

## Hook Extensions

Amazon Vinyl TSX provides several built-in hook extensions for enhanced DOM
manipulation:

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

// Updates automatically
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

            // Return cleanup function (optional)
            return () => {
                console.log('Element disconnected:', el)
            }
        }}
    >
        Content
    </div>
)
```

### Event Handlers

Amazon Vinyl TSX automatically applies passive event listeners for touch and
scroll events:

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
        <li>Item 3</li>
    </Fragment>
)

// Or with JSX fragment syntax
const list2 = (
    <>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
    </>
)
```

## Advanced Usage

### Custom Components

Create reusable components as functions:

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

// Usage
const myButton = <Button text="Click me" onClick={() => alert('Clicked!')} />
```

### Reactive Text Content

Text content automatically becomes reactive when using observables:

```tsx
const message = data('Hello')
const count = data(0)

const dynamicContent = (
    <div>
        <p>{message}</p>
        <p>Count: {count}</p>
    </div>
)

message.value = 'Hello World!' // Text updates automatically
count.value = 42 // Count updates automatically
```

### Conditional Rendering

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

1. **Initialize Connected Observer**: Call `initializeConnectedObserver()` once
   in your application to enable lifecycle management:

```tsx
import { initializeConnectedObserver } from '@amazon/vinyl-tsx'

// Call once at application startup
const cleanup = initializeConnectedObserver()

// Call cleanup when shutting down (optional)
// cleanup()
```

1. **Use Observables for Dynamic Content**: Prefer observable values for
   properties that change over time.

2. **Leverage Hook Extensions**: Use built-in hooks like `style`, `visible`, and
   `classList` for common DOM manipulations.

3. **Type Safety**: Take advantage of TypeScript's type checking for props and
   children.

4. **Memory Management**: The library automatically handles cleanup for
   observable subscriptions when elements are disconnected.

## Performance Considerations

- **Selective Updates**: Only observable properties trigger DOM updates when
  changed
- **Passive Events**: Touch and scroll events use passive listeners for better
  performance
- **Efficient Cleanup**: Automatic subscription cleanup prevents memory leaks
- **Minimal Bundle Size**: Zero runtime dependencies keep bundle size small
