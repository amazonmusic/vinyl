# Usage Guide

# Installation

```shell
npm install @amazon/vinyl
```

## Creating a Player

To create a new player, call `createVinylPlayer` with desired configuration.
Refer to the API Documentation for configuration options.

```typescript
import { createVinylPlayer } from '@amazon/vinyl'

createVinylPlayer({ media: new Audio() })
```

## Loading Tracks

Tracks are constructed as-needed from load configuration objects.

For DRM configuration and encrypted content, see
[DRM Configuration](./DRM_CONFIGURATION.md).

Tracks are constructed when they are prefetched, then disposed when they are no
longer in the queue and the cache evicts tracks least recently used.

Basic example:

```typescript
import { createVinylPlayer } from '@amazon/vinyl'

const media = new Audio()
media.controls = true
document.body.appendChild(media)

const player = createVinylPlayer({ media })
player.load(
    {
        type: 'src',
        uri: 'https://example.com/myTrack.mp3',
    },
    {
        type: 'dash',
        uri: 'https://example.com/myNextTrack.mpd',
    },
    {
        type: 'hls',
        uri: 'https://example.com/myTrack.m3u8',
    }
)
```

### HLS Track Configuration

HLS tracks use the `'hls'` type and play fMP4 HLS streams via Media Source
Extensions. This works on all browsers that support MSE (Chrome, Firefox, Edge,
Safari 17+). The `uri` should point to an HLS main playlist (`.m3u8`).

```typescript
player.load({
    type: 'hls',
    uri: 'https://example.com/main.m3u8',
})
```

Media playlists are fetched lazily — only the variant selected by ABR is
fetched, and results are cached. For video content with separate audio
renditions, the audio rendition playlist is resolved automatically.

Because HLS tracks use the same MSE pipeline as Dash, they benefit from all of
Amazon Vinyl's streaming features: adaptive bitrate switching, track preloading
and prefetching, quality filtering, buffering control, and network
prioritization.

A custom manifest provider can be supplied to override the default fetch
behavior:

```typescript
player.load({
    type: 'hls',
    uri: 'unique_identifier',
    manifestProvider: async (abort) => {
        const baseUrl = 'https://example.com/main.m3u8'
        const response = await requestWithRetry(baseUrl, undefined, { abort })
        const text = await response.text()
        const mainPlaylist = parseMainPlaylist(text)
        return {
            mainPlaylist,
            baseUrl,
            getMediaPlaylist: memoize(
                async (uri) => {
                    const resp = await requestWithRetry(new URL(uri, baseUrl))
                    return parseMediaPlaylist(await resp.text())
                },
                (uri) => uri
            ),
        }
    },
})
```

> **Note:** HLS via MSE supports both fMP4 streams (those with `#EXT-X-MAP`) and
> MPEG-TS streams, which are transmuxed to fMP4 on the fly. MPEG-TS via MSE does
> not support encrypted content — for encrypted MPEG-TS, use native HLS playback
> on Safari and iOS by loading the stream with the `'src'` track type.

### Dash Track Configuration

Dash track default behavior is to treat the `uri` as the Dash MPD location. This
can be overridden with a custom manifest provider, which is returns a parsed
dash manifest.

```typescript
player.load({
    type: 'dash',
    uri: 'unique_identifier',
    manifestProvider: async () => {
        const response = await requestWithRetry('https://example.com/service')
        const manifestStr = await response.json().MPD
        return {
            manifest: parseDashManifest(manifestStr),
            baseUri: new URL('https://example.com'),
        }
    },
})
```

Load sets the queue. To begin playback, invoke `player.play()`. Depending on
browser autoplay policies, the first call to `play()` must be in response to a
user interaction such as a click, touch, key, or voice event.

```html
<script>
    function play() {
        // play() rejections should be handled, but are typically recoverable. Reasons for rejection include
        // an AbortError from a track change, or NotAllowed due to not being first called from a user interaction such
        // as a click or keypress.
        // Not catching rejections will result in unhandled promise rejections logging to the console.
        player.play().catch((error) => console.warn(error))
    }
</script>

<body>
    <button onclick="play()">PLAY</button>
</body>
```

To append tracks to the current queue without stopping the currently playing
track, use `enqueue`.

### Track Preload

To preload tracks without adding them to the queue, for example on a mouse
hover, use `preload`. `preload` creates and caches the track.

Usage example:

```html
<script>
    const track = {
        type: 'src',
        uri: 'https://example.com/myTrack.mp3',
    }

    function preload() {
        player.preload(track)
    }

    function load() {
        player.load(track)
    }
</script>
<body>
    <img
        alt="play"
        src="https://example.com/image.jpg"
        onmouseenter="preload()"
        onclick="load()"
    />
</body>
```

#### Preload Cache

If a list of tracks are provided to preload, the cache capacity will
automatically grow to accommodate all provided tracks.

Cached preloaded tracks are disposed automatically. When the cache capacity has
been reached, the least recently used track will be disposed.

### Track Enqueue

To append tracks to the current queue without affecting playback, use `enqueue`.

Usage example:

```typescript
player.on('currentTrackChange', () => {
    if (player.queue.length < 2) {
        // Queue is nearing exhaustion, append more tracks
        player.enqueue(
            {
                type: 'src',
                uri: 'https://example.com/myTrack1.mp3',
            },
            {
                type: 'dash',
                uri: 'https://example.com/myTrack2.mpd',
            },
            {
                type: 'dash',
                uri: 'https://example.com/myTrack3.mpd',
            }
        )
    }
})
```

### Track Events

There are two events related to track queues.

See `TrackControllerEventMap` in API Docs for full documentation.

`queueEnded` - Emitted when the last track of the playback queue has ended.

`currentTrackChange` - Emitted when the current track has changed.

When the last track in the queue has ended, it will not automatically be
unloaded. To automatically unload when the queue ends, one could write:

`player.on('queueEnded', () => player.unload())`

When a track ends, an `ended` event is emitted. This event is emitted before the
queue moves to the next track. If an `ended` handler changes the queue, the
automatic track transition will be canceled.

For example, to interrupt an automatic queue transition, one could write:

```typescript
player.on('ended', () => {
    if (shouldInterrupt) player.clearQueue()
})
```

### Track Preloading/Prefetching Configuration

To change initial cache capacity or number of tracks prefetched, when
constructing the player, provide configuration to `trackController`.

Example:

```typescript
import { createVinylPlayer } from '@amazon/vinyl'

createVinylPlayer(
    { media: new Audio() },
    {
        trackController: {
            trackPrefetchCount: 3,
            preloadCapacity: 5,
        },
    }
)
```

Increasing prefetch count can reduce playback delay when rapidly skipping tracks
at the cost of increased memory and network usage.

## Playback Control

Controlling playback should be done through the Amazon Vinyl player reference,
not the media element. This is to ensure that controls are consistent across
browsers and devices.

The basic playback operations are `play`, `pause`, and `seekTo`.

`play()` invokes `play()` on the media element with additional safety around
awaiting track loading. Unlike when using the media element, `play` and `pause`
may be invoked before the track has finished loading.

`play` may reject if interrupted from another track load, or if the media
element is not 'unlocked' by calling `play` in response to a user interaction.
User interactions include click, touch, tap, key, or voice events. Autoplay
policies are browser-dependent, and may not apply to all devices such as
televisions.

It is recommended to connect UI elements such as a play button to a synchronous
call to `play()`, and adding a rejection handler which may ignore play
rejections.

`seekTo` seeks the media to the given time. `seekTo` has additional safety over
setting currentTime on the media element directly. `seekTo` awaits track
seekable ranges, ensures seeking is to a seekable time range, and ensures rapid
seek operations resolves to the final time.

For full documentation on playback commands, see the API Docs for
`PlaybackController`.

## Playback Events

When observing Amazon Vinyl events, use `on` for event registration.

Example:

```typescript
const timeUpdateSub = player.on('timeUpdate', (event) => {
    console.log(`currentTime is now ${player.currentTime}.`)
})
```

Invoke the returned Unsubscribe callback to remove the handler. If the player is
disposed, the handlers will be cleared.

Read the API Docs on `PlaybackControllerEventMap` for the full list of playback
events. Most events are directly from the media element, but there are
additional second-order events such as 'played', 'waited', or 'mutedChange'.

### Buffer Status

There are two concepts to understand when talking about how much data is
buffered: `buffered` data and `fetched` data. `fetched` data refers to data
streamed from the network. `buffered` data refers to data that has finished
decoding and decrypting. When indicating to the user how much data is loaded,
the fetched time ranges is the more relevant of the two.

To show an indicator for prefetch, use the `fetchedRangesChange` event and
`fetchedTimePercent` property.

```typescript
function setPrefetched(percent: number) {
    // Update UI
}

player.on('fetchedRangesChange', () => {
    setPrefetched(player.fetchedTimePercent)
})
setPrefetched(0)
```

## Quality Information

Amazon Vinyl provides access to media quality information for different content
types (audio, video, text) through quality accessor methods. Quality metadata
progresses through three stages:

- **Streaming Quality**: The quality being requested for streaming
- **Buffering Quality**: The quality currently being buffered/decoded
- **Playback Quality**: The quality currently being played back

### Accessing Quality Information

```typescript
// Get current content types (e.g., Set(['audio', 'video']))
const contentTypes = player.contentTypes

// Get quality for specific content type
const audioStreamingQuality = player.getStreamingQuality('audio')
const videoBufferingQuality = player.getBufferingQuality('video')
const audioPlaybackQuality = player.getPlaybackQuality('audio')

// Returns null if no quality available for the content type
const textQuality = player.getStreamingQuality('text') // null if no text track
```

### Quality Change Events

Listen for quality changes across all content types:

```typescript
player.on('contentTypesChange', (event) => {
    console.log('Content types changed:', event.previous, '→', event.current)
})

player.on('streamingQualityChange', (event) => {
    console.log(
        'Streaming quality changed:',
        event.previous,
        '→',
        event.current
    )
})

player.on('bufferingQualityChange', (event) => {
    console.log(
        'Buffering quality changed:',
        event.previous,
        '→',
        event.current
    )
})

player.on('playbackQualityChange', (event) => {
    console.log('Playback quality changed:', event.previous, '→', event.current)
})
```

## Adaptive Bitrate Configuration

Adaptive bitrate behavior is configured through `player.configure({ abr })` and
can be changed at any time; the timeline is re-evaluated on the next quality
selection.

### Capping Bandwidth

Use `abr.maxBandwidth` to cap the maximum per-second bandwidth (in bits per
second) of any selectable quality. This is a soft cap: if no qualities fit
within the limit, the lowest-bandwidth quality is selected so playback remains
possible. Setting `maxBandwidth` to `0` therefore pins playback to the lowest
available quality.

`maxBandwidth` has no effect when `strategy` is `AbrStrategy.LOWEST` or
`AbrStrategy.HIGHEST`, since those strategies pin selection regardless of
bandwidth.

```typescript
// Limit selectable qualities to 1.5 Mbps or less.
player.configure({
    abr: {
        maxBandwidth: 1_500_000,
    },
})

// Pin to the lowest available quality.
player.configure({ abr: { maxBandwidth: 0 } })

// Remove the cap.
player.configure({ abr: { maxBandwidth: null } })
```
