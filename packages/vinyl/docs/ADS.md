# Ad Interstitials

The Amazon Vinyl player supports server-guided ad insertion (SGAI) via HLS
Interstitials (`EXT-X-DATERANGE` with `CLASS="com.apple.hls.interstitial"`). Ad
breaks are discovered from the manifest, exposed through a provider-agnostic
model, and played back transparently on the same media element as content.

DASH SCTE-35 ad support is planned as a fast follow and will surface through the
same `AdController` model, so application code written against this API will not
need to change.

## The model

Ads are described by a small, provider-agnostic model. Applications observe it
through the player; they never deal with HLS- or DASH-specific tags.

- **`AdBreakInfo`** — a span of the timeline that carries advertising instead of
  primary content. It has an `id`, a `startTime` and `duration` (in seconds on
  the media timeline), a `placement` (`preroll` | `midroll` | `postroll`),
  optional `restrict` rules, and an `ads()` resolver.
- **`AdInfo`** — a single ad within a break, with its own `id`, `startTime`,
  `duration`, and asset `uri`.
- **`ads()`** — a function returning `Promise<readonly AdInfo[]>`. Asset lists
  that are fetched lazily (e.g. an HLS `X-ASSET-LIST`) resolve on first call and
  cache; breaks whose assets are known up front resolve immediately.

Ad assets are full tracks. An ad can be another HLS manifest, an MP4, or any
source the player can otherwise play. The track type is inferred from the asset
URL's extension today; MIME-type probing for extension-less URLs is a planned
follow-up.

## Player API

```typescript
// The ad breaks discovered for the current media, ordered by start time.
player.adBreaks // readonly AdBreakInfo[]

// The break currently containing the playhead, or null in primary content.
player.activeAdBreak // AdBreakInfo | null

// The ad track currently playing over the (suspended) content track, or null.
// This is exposed separately from `currentTrack`, which keeps referencing the
// content track while an ad plays.
player.currentAdTrack // ReadonlyTrack | null

// Skip the current ad. If more ads remain in the break the next one begins;
// otherwise the break ends and content resumes. No-op with no active break.
player.skipAd()

// Skip the entire active break and resume content. No-op with no active break.
player.skipAdBreak()
```

### Events

```typescript
// The set of known ad breaks changed (e.g. a live manifest revealed one).
player.on('adBreaksChange', ({ current }) => {
    /* current: AdBreakInfo[] */
})

// The break containing the playhead changed. `current` is the newly active
// break, or null when the playhead moved back into primary content (the break
// played through, was skipped, or the media changed).
player.on('adBreakChange', ({ previous, current }) => {
    /* … */
})
```

## How playback works

Ad breaks are played on the **same media element** as content — there is no
second video element. When the playhead enters a break, the `TrackController`:

1. Suspends the content track, remembering the resume position.
2. Creates (or reuses a preloaded) ad track and activates it.
3. Sequences through the break's ads. Each ad plays to its end (or is skipped),
   then the next ad activates.
4. When the break ends, reactivates the content track at the resume position the
   break dictates (ads either replace embedded content or resume from the prior
   position).

Ad tracks are preloaded ahead of their break (about 20 seconds of lookahead) so
they start promptly, and are disposed when the content track changes.

### Placement notes

- **Preroll** ads play before content begins.
- **Midroll** ads play when the playhead crosses into the break.
- **Postroll** ads play at the end of content. Because a postroll's start sits
  at (or just past) the content's end, the playhead rarely reports a time inside
  it before the content's `ended` fires — so the player treats a content `ended`
  as the trigger to play a pending postroll before finishing the queue.

## Restrictions

A break may carry restrictions (from an HLS `X-RESTRICT`) describing what the
**application** should allow. The player itself never blocks `skipAd`,
`skipAdBreak`, or seeking — it always honors the API — but it surfaces the
break's rules so applications can decide whether to expose those controls:

```typescript
const activeBreak = player.activeAdBreak
const canSkip = !activeBreak?.restrict?.skip // hide the Skip button when true
const canSeek = !activeBreak?.restrict?.jump // disable seeking past the ad
```

## Distinguishing ad `ended` from content `ended`

> **This is the most important integration note.** Read it if you act on `ended`
> events yourself.

If you rely on Vinyl's queue (`load`, `enqueue`, `next`), you do not need to do
anything — the player suppresses queue advancement during ads, plays the ad, and
resumes content automatically.

However, ads play on the same media element as content, so the underlying
`ended` event fires **for each ad as well as for content**. If your application
listens for `ended` (or `emptied`, etc.) to drive its own logic — advancing your
own queue, logging completion, updating UI — you must differentiate an
ad-originated `ended` from a content-originated one. **Treating an ad's `ended`
as content completion is the classic bug**: you would advance your queue while
an ad is still playing.

Use `player.activeAdBreak` (or the convenience `currentAdTrack`) to tell them
apart:

```typescript
player.on('ended', () => {
    if (player.activeAdBreak != null) {
        // An ad ended. The player handles sequencing to the next ad or
        // resuming content — do NOT advance your own queue here.
        return
    }
    // Genuine content completion — safe to advance your queue / update UI.
    playNextInMyQueue()
})
```

The rule of thumb: **an `ended` (or `emptied`) while `activeAdBreak` is non-null
originated from an ad, not from content.** `currentAdTrack` is equivalent and
reads more directly if you think in terms of tracks:

```typescript
player.on('ended', () => {
    if (player.currentAdTrack != null) return // ad ended; ignore
    playNextInMyQueue()
})
```

## Manifest variable substitution

HLS ad manifests (e.g. AWS MediaTailor) frequently rely on `EXT-X-DEFINE`
variable substitution, including:

- `NAME` / `VALUE` — a literal definition.
- `IMPORT` — inherit a value defined in the parent multivariant playlist.
- `QUERYPARAM` — take a value from a named query parameter on the playlist's own
  URL (common for session tokens on ad manifests).

Vinyl resolves all three when parsing, so `{$token}` references in ad segment
and rendition URIs are substituted before the ad track fetches them. No
application configuration is required.

## Example

```typescript
import { createVinylPlayer } from '@amazon/vinyl'

const player = createVinylPlayer({ media: videoElement })

// Reflect ad state in your UI.
player.on('adBreakChange', ({ current }) => {
    if (current) {
        showAdOverlay({
            canSkip: !current.restrict?.skip,
        })
    } else {
        hideAdOverlay()
    }
})

// If you drive your own queue off `ended`, guard against ad ends.
player.on('ended', () => {
    if (player.activeAdBreak != null) return
    playNextInMyQueue()
})

player.load({ type: 'hls', uri: 'https://example.com/episode.m3u8' })
await player.play()
```
