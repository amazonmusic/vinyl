# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.3]() (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-website

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.2]() (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-website

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.1]() (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-website

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0]() (2026-08-26)

### ⚠ BREAKING CHANGES

- **track:** The TrackController currentTrackChange event is removed. Subscribe
  to trackActivated and trackDeactivated (each carrying the track) instead, and
  read the active track via activeTrack (renamed from currentTrack), which
  returns a track only once it is active.
- **ad:** The AdController API is reworked around a parent content track. Ad
  discovery is driven by setParentTrack plus async getAds()/adsChange rather
  than pushed ad lists, and the break lifecycle is exposed via
  adBreakEntered/adBreakCompleted.
- **ad:** The AdController currentAdBreakChange event is removed. Subscribe to
  adBreakEntered and adBreakCompleted instead. The content resumePosition moves
  off the per-ad AdCompleteEvent onto AdBreakCompleteEvent.

### Features

- **ad:** add adTimeUpdate event with ad and break time remaining
  ([f4020e2](https://github.com/amazonmusic/vinyl/commits/f4020e2611db777ef89b845931d3244dc45028ca))
- **ad:** rework ad/track controllers around a parent-track ad model
  ([689512f](https://github.com/amazonmusic/vinyl/commits/689512f65f8f4274ba67137f077c7aa27f2909f8))
- **ad:** split currentAdBreakChange into adBreakEntered/adBreakCompleted;
  resume per break
  ([c378917](https://github.com/amazonmusic/vinyl/commits/c378917bb9888a4bb2cee249fc3df25ac2100b68))
- **ad:** surface an ad skip window and gate skipping on it
  ([75a2ccd](https://github.com/amazonmusic/vinyl/commits/75a2ccd598b3da5ae4fe4a3d2517b57d142e059b))
- **streaming:** add preferDescriptiveAudio opt-in + demo toggle
  ([e255d57](https://github.com/amazonmusic/vinyl/commits/e255d577a924ce5cf5cfe1899359423b2a2b988f))
- **text:** discover and activate sidecar WebVTT text tracks
  ([281c947](https://github.com/amazonmusic/vinyl/commits/281c947722e77a006b8e1ff3ab54543f58f59260))
- **text:** distinguish forced and full text tracks by structured metadata
  ([c7bfe29](https://github.com/amazonmusic/vinyl/commits/c7bfe29dbac6481f078ae325240c6b2e8ac8d78e))
- **text:** select captions by preferred language config
  ([5a7600c](https://github.com/amazonmusic/vinyl/commits/5a7600c383162824bcb48862fbccb58f211e0f45))
- **website:** add a + button to enqueue demo and custom-URL tracks
  ([879ca3e](https://github.com/amazonmusic/vinyl/commits/879ca3ed2df22325b6cf6753459d1feff9922fc5))
- **website:** add a settings menu to the player controls
  ([42c991c](https://github.com/amazonmusic/vinyl/commits/42c991cb979db603b5de0e2a18c4faaa995a82dc))
- **website:** add ad-break test streams in a collapsible section
  ([dc53526](https://github.com/amazonmusic/vinyl/commits/dc535263a60dc313ae394d9ca4d11e19fc903129))
- **website:** always open the captions dropdown, even for one track
  ([15feaa7](https://github.com/amazonmusic/vinyl/commits/15feaa77fb248e08497b68f3f6fc5448aefa4716))
- **website:** keep custom controls in fullscreen and auto-hide them
  ([2c719b2](https://github.com/amazonmusic/vinyl/commits/2c719b21047968ce5f7f230a16c9913525346fd7))
- **website:** settings-menu icons, audio-language fix, descriptive-audio, a11y
  ([6dbec50](https://github.com/amazonmusic/vinyl/commits/6dbec508c1f1a9182d8dd12f500008bfae4c1584))
- **website:** show ad markers, skip button, and seek range in demo
  ([5d5f145](https://github.com/amazonmusic/vinyl/commits/5d5f145140a99beb73a6139fe67335d406f7b955))

### Bug Fixes

- **vinyl-tsx:** tighten JSX prop typing, simplify setProp null path
  ([a64bae1](https://github.com/amazonmusic/vinyl/commits/a64bae15271c80f5fb9cd91f956886192339de01))
- **website:** keep settings menu open when drilling into sub-menus
  ([cddf0d1](https://github.com/amazonmusic/vinyl/commits/cddf0d15441790bbeab66265e41ba6d98bd57729))

### Code Refactoring

- **track:** split currentTrackChange into trackActivated/trackDeactivated
  ([3ff29c7](https://github.com/amazonmusic/vinyl/commits/3ff29c762cdcb62efef192d036a1e624bfd4a30d))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.2.0]() (2026-07-02)

### Bug Fixes

- **website:** drive video visibility from track, not streaming quality
  ([595fbec](https://github.com/amazonmusic/vinyl/commits/595fbec1eee1288b422b2dadcece6dbf60499190))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.1.1]() (2026-05-28)

**Note:** Version bump only for package @amazon/vinyl-website

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.1.0 (2026-05-28)

### Bug Fixes

- correct repository URL in package.json files
  ([f8737f8](https://github.com/amazonmusic/vinyl/commits/f8737f88b9d57f0be578801e00a30f66ed47f6fd))
- **streaming:** prevent duplicate playback on timeline misalignment
  ([466d936](https://github.com/amazonmusic/vinyl/commits/466d93690c9845fe826b7a4c3103d54c8c27a967))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.0.0 (2026-05-21)

### Bug Fixes

- correct repository URL in package.json files
  ([f5c2d6c](https://github.com/amazonmusic/vinyl/commits/f5c2d6ca1645ea84935d1c1a4434676bbb30e12d))
- **streaming:** prevent duplicate playback on timeline misalignment
  ([466d936](https://github.com/amazonmusic/vinyl/commits/466d93690c9845fe826b7a4c3103d54c8c27a967))
