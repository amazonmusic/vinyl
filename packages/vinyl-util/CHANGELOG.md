# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [5.0.0](https://github.com/amazonmusic/vinyl/compare/v4.1.0...v5.0.0) (2026-11-16)

### Features

- **util:** read media timestamps from fragmented MP4 segments
  ([39db3ae](https://github.com/amazonmusic/vinyl/commit/39db3aed100f02def2eff18327d8982ec921dec6))

### Bug Fixes

- **util:** apply the edit list to the presentation time range of fragmented MP4
  segments
  ([4c3fc1d](https://github.com/amazonmusic/vinyl/commit/4c3fc1d63750784895ae905b8373a3ed54c6f058))
- **util:** clone a Request input on each requester attempt so retries can
  resend its body
  ([a374639](https://github.com/amazonmusic/vinyl/commit/a374639f89899f4f30671cb60bfd3b9f8c57faf9))
- **util:** read the init timing of fragmented MP4 from a single track
  ([14e0e61](https://github.com/amazonmusic/vinyl/commit/14e0e61703574f0ae453637157987897a3792263))
- **util:** redact RequestError headers and fields by credential name pattern
  ([0a8f8ef](https://github.com/amazonmusic/vinyl/commit/0a8f8ef4090c77eefac6806a50b10661936d583d))
- **util:** return the presentation time range of fragmented MP4 segments
  ([111fdd5](https://github.com/amazonmusic/vinyl/commit/111fdd5caf0715a02829f6fe5393ca3e09cb23b7))
- **util:** serialize a RequestError whose event lacks the request input, init
  or response url
  ([e5b2035](https://github.com/amazonmusic/vinyl/commit/e5b20359df88ae46371ee37284631d4a62640590))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.1.0](https://github.com/amazonmusic/vinyl/compare/v4.0.0...v4.1.0) (2026-10-20)

### Bug Fixes

- **mse:** don&#x27;t remove source buffers a reopened media source already
  dropped
  ([5b5a663](https://github.com/amazonmusic/vinyl/commit/5b5a663726ef082b01ad7fdb9b698ad760d787b1))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.0.0](https://github.com/amazonmusic/vinyl/compare/v3.2.2...v4.0.0) (2026-10-14)

### Features

- **util:** add BitReader for bit-packed fields
  ([0987783](https://github.com/amazonmusic/vinyl/commit/0987783298f5de9602cf1eae604e49eab0c8854f))
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
