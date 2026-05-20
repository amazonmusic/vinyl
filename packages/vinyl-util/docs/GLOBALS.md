# Globals

Amazon Vinyl has a registry of a select few global references.

Global state is limited to that which is scoped to the window, such as the
networking layer and logging.

To override a global reference, before the reference is first used (that is,
before the first player is created or first utility method called), set an
override via `set`. Example:

```typescript
import { requesterWithRetryRef } from '@amazon/vinyl-util'

// Overridden until the global registry is reset:
requesterWithRetryRef.set(() => {
    return createRequester({
        retryOptions: RetryStrategy.NO_RETRIES,
    })
})
```

Global references are constructed upon first use, and will throw if a cyclic
dependency is detected.

All global state may be cleared and reset with `globalRegistry.reset`. For
example if an application has a dormant state, all players can be disposed and
global state reset to free memory. After a reset, overrides will be removed and
can be reset with their override references.

Example:

```typescript
import { globalRef, getGlobalRegistry } from '@amazon/vinyl-util'

const globalRef = globalRef(() => 1)

const override = globalRef.set(() => 2)

globalRef.value // 2

getGlobalRegistry().reset() // Overrides cleared
override.initialize() // Resets the initializer
globalRef.value // 2
```
