# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.3.0](https://github.com/amazonmusic/vinyl/compare/v3.2.2...v3.3.0) (2026-09-30)

### Features

- **util:** add rateLimit token-bucket rate limiter
  ([f3660d8](https://github.com/amazonmusic/vinyl/commit/f3660d8ba3fa7e211770ce8600aebcb6af01fdda))

### Bug Fixes

- **drm:** honor buffer view bounds on key message and init data
  ([de1979e](https://github.com/amazonmusic/vinyl/commit/de1979e4e0079e059d492ff6b8d09ea4ba817ee1))
- **util:** decode hex and astral XML character references
  ([bf6164d](https://github.com/amazonmusic/vinyl/commit/bf6164d4365308bc61b2714991fcf3f98af91b9c)),
  closes [#x26](https://github.com/amazonmusic/vinyl/issues/x26)
  [#128512](https://github.com/amazonmusic/vinyl/issues/128512)
- **util:** don&#x27;t cache a throw as an undefined memoized result
  ([31c4169](https://github.com/amazonmusic/vinyl/commit/31c4169f31214d0250d1677758421c3e18672b5d))
- **util:** keep the request timeout alive across retries
  ([c37b3a6](https://github.com/amazonmusic/vinyl/commit/c37b3a6b244de174f5d0f77b1e6792419d77e1ae))
- **util:** read NetworkInformation downlink as decimal megabits
  ([27b667e](https://github.com/amazonmusic/vinyl/commit/27b667e6f95980d7f8e762e9f10c2131d1c761a1))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.2](https://github.com/amazonmusic/vinyl/compare/v3.2.1...v3.2.2) (2026-09-23)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.1](https://github.com/amazonmusic/vinyl/compare/v3.2.0...v3.2.1) (2026-09-17)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.0](https://github.com/amazonmusic/vinyl/compare/v3.1.0...v3.2.0) (2026-09-09)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.1.0](https://github.com/amazonmusic/vinyl/compare/v3.0.1...v3.1.0) (2026-09-05)

### Features

- **dash:** support WebM (VP9/Opus) via SegmentBase EBML Cues indexing
  ([a4e35fa](https://github.com/amazonmusic/vinyl/commit/a4e35fa5a02788db56255dd459947106f84ba34d))
- **playback:** post-seek stall detector; remove the media-patching system
  ([8857ace](https://github.com/amazonmusic/vinyl/commit/8857acebf222ef5fce3148b16f317e5321908275))

### Bug Fixes

- **network:** classify response body-read failures with a service origin
  ([5356030](https://github.com/amazonmusic/vinyl/commit/5356030d0e7581ba3c69fcb28e617aefdfa35070))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.0.1](<>) (2026-08-28)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.0.0](<>) (2026-08-28)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.4](<>) (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.3](<>) (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.2](<>) (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.1](<>) (2026-08-27)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](<>) (2026-08-26)

### Features

- **ad:** add HLS SGAI ad interstitials (AdController + TrackController)
  ([aa18318](https://github.com/amazonmusic/vinyl/commits/aa183182304fadffb6b060636610a0430639d387))
- **util:** add poll async utility
  ([3144b18](https://github.com/amazonmusic/vinyl/commits/3144b184888029e19e9a6c7d7649bb167b91c495))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.2.0](<>) (2026-07-02)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.1.1](<>) (2026-05-28)

**Note:** Version bump only for package @amazon/vinyl-util

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.1.0 (2026-05-28)

### Features

- **vinyl-util:** capture init stack on GlobalRef when debug is enabled
  ([4d5d86d](https://github.com/amazonmusic/vinyl/commits/4d5d86d3a289e2c8c0cc9ba1b098322ec88be695))

### Bug Fixes

- correct repository URL in package.json files
  ([f8737f8](https://github.com/amazonmusic/vinyl/commits/f8737f88b9d57f0be578801e00a30f66ed47f6fd))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 1.0.0 (2026-05-21)

### Bug Fixes

- correct repository URL in package.json files
  ([f5c2d6c](https://github.com/amazonmusic/vinyl/commits/f5c2d6ca1645ea84935d1c1a4434676bbb30e12d))
