# Auto Reset Logic

The Amazon Vinyl player includes automatic error recovery through the
`AutoResetController`, which monitors for playback errors and attempts to
recover from transient failures.

## How It Works

### Error Detection

- The `VinylPlayer` forwards all error events to the `AutoResetController`
- Only `SERVICE_INTERNAL` `ReportableError` instances trigger auto-reset
  behavior
- Other error types (e.g., `SERVICE_EXTERNAL`, `MEDIA`, `API`) are ignored

### Reset Triggers

The controller monitors for retry opportunities and emits reset events in these
scenarios:

1. **Network Recovery**: Immediately when the device comes back online
2. **Timed Retry**: After `retryInterval` seconds if the device is online and
   retry limit not exceeded
3. **User Actions**: Immediately on user-initiated playback events:
    - `play`
    - `pause`
    - `seeking`
    - `playing`

### Reset Process

When a reset is triggered:

1. All controllers are reset by `VinylPlayer`: `DrmController`,
   `PlaybackController`, `TrackController`
2. Error state is cleared
3. Retry counter is reset to 0 (for user actions only)
4. A `reset` event is dispatched

### Retry Limits

- Maximum retries: `maxRetries` (default: 30)
- Retry interval: `retryInterval` seconds (default: 30)
- User actions reset the retry counter, allowing unlimited user-initiated
  retries

## Configuration

```typescript
const player = createVinylPlayer({
    autoResetController: {
        enabled: true, // Enable/disable auto-reset (default: true)
        maxRetries: 30, // Max automatic retries (default: 30)
        retryInterval: 30, // Seconds between retries (default: 30)
    },
})
```

## Integration Points

- **VinylPlayer**: Forwards errors to controller, listens for reset events
- **DrmController**: Retries failed license requests on reset
- **PlaybackController**: Handles media element recovery
- **TrackController**: Resets current track state
- **NetworkState**: Monitors online/offline status

## Debugging

Enable debug logging (?vinylLogLevel=debug) to monitor auto-reset behavior:

```typescript
// Look for these log messages (filter on 'reset'):
// "setError" - Error monitoring started
// "online, emitting reset" - Network recovery triggered
// "interval, emitting reset" - Timeout retry triggered
// "max retries exhausted" - Retry limit reached
```
