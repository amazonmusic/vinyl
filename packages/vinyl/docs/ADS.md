# Ads

The Amazon Vinyl player discovers ad breaks from HLS and DASH manifests, exposes
them through one provider-agnostic model, and plays them on the same media
element as content. Two kinds of break are supported:

- **Interstitial** breaks (server-guided or client-side ad insertion,
  SGAI/CSAI): each ad is its own presentation, which the player switches to
  while content waits. Signalled by HLS Interstitials (`EXT-X-DATERANGE` with
  `CLASS="com.apple.hls.interstitial"`) and DASH alternative MPD events
  (`InsertPresentation` / `ReplacePresentation`, ISO/IEC 23009-1 5.16).
- **Stitched** breaks (server-side ad insertion, SSAI): the ads are already part
  of the content's media timeline, as produced by AWS Elemental MediaTailor and
  other SSAI services. The player plays straight through them and reports the
  break and its ads from the playhead. Signalled by SCTE-35: HLS
  `EXT-X-DATERANGE` `SCTE35-OUT` / `SCTE35-IN` / `SCTE35-CMD`, and DASH MPD
  events in the SCTE 214-1 schemes.

See [Signals](#signals) for exactly what is read, and
[Ad decisioning](#ad-decisioning-vast-vmap) for filling breaks from an ad
server.

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
  `insertion` is `interstitial` (the default when absent) or `stitched`, and
  `signal` describes the manifest signal the break came from: its `source`
  (`hls-interstitial`, `hls-scte35`, `dash-scte35`, or `dash-alternative-mpd`),
  the `schemeIdUri`, and the decoded SCTE-35 sections (`scte35`), e.g. for
  reading a segmentation UPID.
- **`AdInfo`** — a single ad within a break, with its own `id`, `startTime`,
  `duration`, and asset `uri` (or `null`). Playback of an ad is capped at its
  `duration` when that is known. A stitched ad has no `uri`; its `startTime` is
  where its media begins within the content.
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

// While an interstitial ad plays it is the active track, so `activeTrack`
// refers to the ad track (not content) during the break. During a stitched
// break the content track stays active.
player.activeTrack // ReadonlyTrack | null

// Skip the current ad. If more ads remain in the break the next one begins;
// otherwise the break ends and content resumes. A stitched ad is skipped by
// seeking to its end. No-op with no active break.
player.skipAd()

// Skip the entire active break and resume content. A stitched break is skipped
// by seeking to its end. No-op with no active break.
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
second video element. When the playhead enters an interstitial break, the
`TrackController`:

1. Suspends the content track, remembering the resume position.
2. Creates (or reuses a preloaded) ad track and activates it.
3. Sequences through the break's ads. Each ad plays to its end (or is skipped),
   then the next ad activates.
4. When the break ends, reactivates the content track at the resume position the
   break dictates (ads either replace embedded content or resume from the prior
   position).

### Stitched breaks

A stitched break is tracked, not played separately: nothing is loaded and the
content track stays active. The `AdController` follows the playhead:

- Crossing into a break emits `adBreakEntered`, and into each ad `adEntered` and
  (while playing) `adPlaying`, with `adTimeUpdate` and quartile events as the ad
  plays. Quartiles are reported only for the parts of the ad that were played
  from before them, as for interstitials.
- Playing across an ad's end emits `adEnded` then `adCompleted` with `ended`;
  playing across the break's end completes the break with `ended`.
- Seeking out of an ad or break completes it with `skipped`. Seeking back into a
  break enters it again; stitched breaks are not suppressed after playing, since
  the content cannot be played without them.
- `skipAd` / `skipAdBreak` complete with `skipped` and seek to the ad's or
  break's end. `restrict.jump` is not enforced: the player does not snap seeks
  back to the break.
- `adBreakCompleted`'s `resumePosition` is where the playhead is (the break's
  end after playing through it). The `TrackController` does not act on it.

Breaks are discovered once per manifest. Stitched ad events require a reasonable
time update rate; with a coarse rate, quartiles reached between two updates are
reported together.

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

## Signals

### HLS Interstitials

`EXT-X-DATERANGE` tags with `CLASS="com.apple.hls.interstitial"`: `X-ASSET-URI`
and `X-ASSET-LIST` (with `SKIP-CONTROL`), `CUE` (`PRE`, `POST`, `ONCE`),
`X-RESTRICT`, `X-RESUME-OFFSET`, `X-PLAYOUT-LIMIT`, and
`X-RESOLUTION-TIME-OFFSET`.

### HLS SCTE-35

`EXT-X-DATERANGE` tags carrying `SCTE35-OUT`, `SCTE35-IN`, or `SCTE35-CMD` (RFC
8216 4.3.2.7.1). Ranges sharing an `ID` are one break: the splice out opens it
and the splice in, usually with the final `DURATION` or `END-DATE`, closes it. A
`SCTE35-CMD` opens a break when it is a `time_signal` with an advertising
segmentation descriptor (break, advertisement, placement opportunity, or ad
block start). The duration is `DURATION`, the `END-DATE` span,
`PLANNED-DURATION`, then the SCTE-35 `break_duration` or
`segmentation_duration`. Each `EXT-X-DISCONTINUITY` within the break starts a
new ad. Dates are mapped to the media timeline by the closest preceding
`EXT-X-PROGRAM-DATE-TIME`, so a program date time is required.

### DASH SCTE-35

`EventStream` events in the SCTE 214-1 schemes:

| `@schemeIdUri`                 | Event body                                                           |
| ------------------------------ | -------------------------------------------------------------------- |
| `urn:scte:scte35:2014:xml+bin` | `<scte35:Signal><scte35:Binary>` with a base64 `splice_info_section` |
| `urn:scte:scte35:2013:xml`     | `<scte35:SpliceInfoSection>` XML                                     |
| `urn:scte:scte35:2013:bin`     | a base64 `splice_info_section` as the element text or `@messageData` |

The SCTE-35 XML namespace is `http://www.scte.org/schemas/35/2016`. Following
DASH-IF IOP v5 Part 5, the Event's `@presentationTime` (less the
`EventStream@presentationTimeOffset`, on the Period's timeline) and `@duration`
give the break's span; without an Event duration, the SCTE-35 `break_duration`
or `segmentation_duration` is used, then the time of the matching splice in
(same `splice_event_id` or `segmentation_event_id`). Each Period starting within
the break is one of its ads (with the Period `@id` as the ad id), which matches
multi-Period SSAI such as MediaTailor's. An avail repeated in several Periods is
reported once.

### DASH alternative MPD

`EventStream` events with `@schemeIdUri`
`urn:mpeg:dash:event:alternativeMPD:insert:2025` or
`urn:mpeg:dash:event:alternativeMPD:replace:2025`, each with an
`InsertPresentation` or `ReplacePresentation` child. `@uri` is the ad (resolved
against the MPD URL), `@maxDuration` is the `playoutLimit`, and
`@earliestResolutionTimeOffset` the `resolutionTimeOffset`, in the EventStream's
timescale. An insert resumes content where it paused (`resumeOffset` 0); a
replace resumes at `@returnOffset`, by default the event's end. A `@uri` without
an `.mpd` or `.m3u8` extension is typed by a HEAD request's `Content-Type`. The
`@uri` may return a list MPD (`MPD@type="list"`), such as an ad pod from an ad
decision server; it plays as one ad of consecutive Periods (see
[List MPDs and remote elements](#list-mpds-and-remote-elements)).

### List MPDs and remote elements

Every DASH manifest's remote content is resolved when it loads, before its ad
breaks are discovered, so it plays as a self-contained presentation:

- **Linked Periods** (ISO/IEC 23009-1 6th edition 5.3.2.6): a Period with an
  `ImportedMPD` takes the content of the referenced static, single-Period MPD,
  keeping its own `@id` and `@start`, the smaller `@duration`, and its
  `EventStream` and `SupplementalProperty` elements unless the imported Period
  has equivalents. The imported MPD's base URLs become the Period's absolute
  `BaseURL`. A list MPD, whose Periods each import an MPD, plays as a
  multi-Period presentation. An import that fails, or is not a static
  single-Period MPD, leaves the Period as it is, without the import.
- **Remote elements** (5.5): a `Period`, `AdaptationSet`, `EventStream`, or
  `SegmentList` with an `xlink:href` is replaced by the elements of the fetched
  fragment, which may link further (up to a depth of 5).
  `urn:mpeg:dash:resolve-to-zero:2013` removes the element. Both
  `xlink:actuate="onLoad"` and `"onRequest"` links are resolved at load, so an
  `onRequest` remote Period (DASH-IF's SGAI late binding) is resolved early
  rather than as the playhead approaches it; its resolved ad Periods are then
  reported like any other, e.g. as stitched SCTE-35 breaks. A link that fails to
  resolve leaves the element's own content; a Period left without content is
  removed.

The manifest request interceptor and `requestInit` apply to these requests.

### SCTE-35 decoding

`decodeSpliceInfoSection` (binary) and `decodeSpliceInfoSectionText` (hex `0x…`
or base64) decode a `splice_info_section` to a `SpliceInfoSection`:
`splice_null`, `splice_insert`, and `time_signal` commands, and segmentation
descriptors. `getSpliceAvail` interprets a section as the start or end of an ad
avail. Encrypted sections, other commands, and other descriptors are reported
but not decoded, and the CRC is not verified.

## Ad decisioning (VAST, VMAP)

Vinyl does not parse VAST or VMAP or fire tracking beacons. Instead, every
discovered break passes through an `AdBreakResolver`, which an application
provides to fill breaks from its ad server:

```typescript
import { createVinylPlayer, type AdBreakResolver } from '@amazon/vinyl'

const adBreakResolver: AdBreakResolver = (adBreak, { trackUri }) => {
    // Keep breaks that already have their ads.
    if (adBreak.signal?.source === 'hls-interstitial') return adBreak
    return {
        ...adBreak,
        // Play the avail's ads client side, then resume after the avail.
        insertion: 'interstitial',
        resumeOffset: adBreak.duration,
        // Resolved lazily, as the break is approached or entered.
        ads: () => requestVastAds(trackUri, adBreak),
    }
}

const player = createVinylPlayer(
    { media: videoElement },
    { adBreakResolver: () => adBreakResolver }
)
```

The resolver is called once per discovered break object (HLS breaks are
rediscovered when a live playlist updates, so memoize ad requests by break `id`
there). It runs for every source, so it can:

- Replace a stitched SCTE-35 avail with client-side ads (as above). The avail's
  SCTE-35 sections in `adBreak.signal.scte35` carry its duration and
  segmentation UPID for the ad request.
- Fill an alternative MPD event or HLS `X-ASSET-LIST`-style break whose URI is
  an ad decision endpoint.
- Leave stitched breaks stitched and add tracking: listen for `adEntered`,
  quartile events, and `adCompleted` and fire the beacons from your VAST
  response.

Mapping a VAST response to `AdInfo`: each linear `<Ad>` in sequence order is an
`AdInfo` with the `<Creative>` id or `<Ad id>` as `id`, `<Duration>` as
`duration`, and the `<MediaFile>` URL (an HLS or DASH rendition, or progressive
MP4) as `uri`. Fire `<Impression>` and the `start`, `firstQuartile`, `midpoint`,
`thirdQuartile`, and `complete` `<Tracking>` events on `adPlaying`,
`adFirstQuartile`, `adMidpoint`, `adThirdQuartile`, and `adEnded`; `skip` on
`adCompleted` with reason `skipped`; and `<Error>` on `adError`. For a VMAP,
each `<vmap:AdBreak timeOffset>` maps to a break (`start` → preroll, `end` →
postroll, a time → midroll) whose `ads` resolves the break's VAST.

### AWS Elemental MediaTailor

MediaTailor's SSAI manifests work without configuration: HLS ad avails carry
`EXT-X-DATERANGE` SCTE-35 and DASH ad avails are separate Periods with
`urn:scte:scte35:2014:xml+bin` events, so they surface as stitched breaks with
one ad per ad Period. MediaTailor's client-side tracking API returns avails with
tracking events keyed by time; match them to breaks by `startTime` and fire the
beacons from the ad events above.

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
