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
  the media timeline), a `placement` (`preroll` | `midroll` | `postroll`), a
  `restrict` rule set (each of `skip`/`jump` optional), and an `ads` resolver.
  It also carries fields that govern replay and resumption: `once` (play the
  break at most once, never replaying it when the playhead re-crosses),
  `resumeOffset` (where primary content resumes relative to the break start;
  `null` advances by the break's actual playout duration, `0` resumes in place),
  `playoutLimit` (a cap on the break's total playout, or `null` when uncapped),
  `resolutionTimeOffset` (how far ahead of the break its assets should be
  resolved and preloaded; `null` falls back to the controller's
  `preloadAheadTime` option — see [Preloading](#preloading)), and a
  `skipControl` resolver (resolving to the window — `{ offset, duration }` —
  during which the ad may be skipped, or `null` when the break carries none).
  These are provider-agnostic; an HLS interstitial, for example, populates them
  from its `CUE=ONCE`, `X-RESUME-OFFSET`, `X-PLAYOUT-LIMIT`,
  `X-RESOLUTION-TIME-OFFSET`, and `X-ASSET-LIST` `SKIP-CONTROL` signals.
- **`AdInfo`** — a single ad within a break, with its own `id`, `startTime`,
  `duration`, and asset `uri` (or `null`). Playback of an ad is capped at its
  `duration` when that is known.
- **`ads`** — a `ValueProvider<AdList>`; resolve it (via `resolveValueProvider`)
  to the break's `readonly AdInfo[]`. Asset lists fetched lazily (e.g. an HLS
  `X-ASSET-LIST`) resolve on first call and cache; breaks whose assets are known
  up front resolve immediately.

Ad assets are full tracks. An ad can be another HLS manifest, an MP4, or any
source the player can otherwise play. The track type is inferred from the asset
URL's extension today; MIME-type probing for extension-less URLs is a planned
follow-up.

## Player API

```typescript
// The ad breaks discovered for the current media (a TrackAds carrying the
// break list), or null before any are known.
player.currentTrackAds // TrackAds | null

// The break currently containing the playhead, or null in primary content.
player.currentAdBreak // AdBreakInfo | null

// The ad currently playing within the active break, or null.
player.currentAd // AdInfo | null

// While an ad plays it is the active track, so `activeTrack` refers to the ad
// track (not content) during a break. `currentAdBreak != null` likewise tells
// you an ad is currently playing.
player.activeTrack // ReadonlyTrack | null

// Skip the current ad. If more ads remain in the break the next one begins;
// otherwise the break ends and content resumes. No-op with no active break.
player.skipAd()

// Skip the entire active break and resume content. No-op with no active break.
player.skipAdBreak()
```

### Events

All of these are dispatched by the `AdController` and redispatched on the
player, so you can listen on `player` directly.

```typescript
// The set of known ad breaks changed (e.g. a live manifest revealed one).
player.on('currentTrackAdsChange', ({ previous, current }) => {
    /* current: TrackAds | null */
})

// The playhead is approaching a midroll/postroll break (within its
// resolution/preload window) and its assets are being warmed. Not emitted for
// prerolls (they are warmed up front). See Preloading.
player.on('adPreload', ({ adBreak }) => {
    /* … */
})

// An ad break was entered — its ads may still be resolving.
player.on('adBreakEntered', ({ adBreak }) => {
    /* … */
})

// The active ad break completed (all ads played, were skipped, it hit its
// playout limit, or it had no ads). `resumePosition` is the absolute
// media-timeline position where content resumes; `reason` is one of
// 'ended' | 'skipped' | 'contentChange' | 'error'.
player.on('adBreakCompleted', ({ adBreak, resumePosition, reason }) => {
    /* … */
})

// An individual ad within the break became active / started playing. Each
// carries { adBreak, ad, index, totalAds }.
player.on('adEntered', (e) => {
    /* … */
})
player.on('adPlaying', (e) => {
    /* … */
})

// Per-tick ad timing while a break plays. Carries elapsed and remaining time
// for the current ad and for the whole break, plus the skip state — `canSkip`
// (whether the ad may be skipped right now) and `skipIn` (seconds until it can
// be, or null). Prefer this over deriving ad timing from the media element.
player.on('adTimeUpdate', (e) => {
    /* e.adCurrentTime, e.adTimeRemaining, e.breakCurrentTime,
       e.breakTimeRemaining, e.canSkip, e.skipIn */
})

// Ad progress milestones. `adEnded` fires at 100%, just before `adCompleted`.
// Each carries { adBreak, ad, index, totalAds, playbackRateAvg }.
player.on('adFirstQuartile', (e) => {})
player.on('adMidpoint', (e) => {})
player.on('adThirdQuartile', (e) => {})
player.on('adEnded', (e) => {})

// An ad stopped playing for any reason (ended, skipped, error). Carries
// { adBreak, ad, index, totalAds, reason }.
player.on('adCompleted', ({ ad, reason }) => {
    /* … */
})

// An ad list failed to load, or an individual ad failed. `currentAd` is set
// only when a specific ad failed (null when the list itself failed to load).
player.on('adError', ({ adBreak, currentAd, error }) => {
    /* … */
})
```

Gate a Skip control on `canSkip` and show a countdown from `skipIn` until the
skip window opens.

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

### Preloading

Ad tracks are preloaded so they start promptly on entry:

- **Prerolls** are warmed up front — when their parent content track is
  preloaded (on `load`, prefetch, or `preload`) — since they play immediately.
- **Midrolls and postrolls** are warmed as the playhead approaches them. The
  `AdController` emits an **`adPreload`** event once the playhead comes within a
  break's lead time: its own `resolutionTimeOffset` (from an HLS
  `X-RESOLUTION-TIME-OFFSET`) when present, otherwise the
  `AdControllerImplOptions.preloadAheadTime` (default 10 seconds). The
  `TrackController` handles that event by resolving and warming the break's ad
  tracks. Seeking back before a break re-arms its preload, so it warms again on
  the next approach; a played-once (or spent) break is not re-warmed.

Preloaded ad tracks are pegged to their parent content track — they carry a
prefetch priority just above it and are disposed when that parent is evicted
from the track cache (or the cache is cleared), so the ad-track store cannot
grow without bound.

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
const activeBreak = player.currentAdBreak
const canSkip = !activeBreak?.restrict.skip // hide the Skip button when true
const canSeek = !activeBreak?.restrict.jump // disable seeking past the ad
```

## Detecting track completion

> **This is the most important integration note.** Read it if you act on track
> completion yourself.

If you rely on Vinyl's queue (`load`, `enqueue`, `next`), you do not need to do
anything — the player suppresses queue advancement during ads, plays the ad, and
resumes content automatically.

If your application drives its own logic off completion — advancing your own
queue, logging a play, updating UI — do **not** listen to the raw media `ended`
event. It fires for every ad as well as for content, and a track's content
`ended` fires _before_ its postroll plays, so even a content `ended` does not
mean the track is done. **Treating either as track completion is the classic
bug.**

Use the **`trackEnded`** event instead. It fires once, when the current track
has fully finished — after its postroll if any — and never for an ad or for
content ending ahead of a postroll:

```typescript
player.on('trackEnded', () => {
    // The track (including any postroll) finished. Safe to log a completed play
    // or advance your own queue. Fires for every track as the queue advances;
    // `queueEnded` additionally fires only after the final track.
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
player.on('adBreakEntered', ({ adBreak }) => {
    showAdOverlay({ canSkip: !adBreak.restrict.skip })
})
player.on('adBreakCompleted', () => {
    hideAdOverlay()
})

// Advance your own queue only on true track completion (handles ads + postroll).
player.on('trackEnded', () => {
    playNextInMyQueue()
})

player.load({ type: 'hls', uri: 'https://example.com/episode.m3u8' })
await player.play()
```
