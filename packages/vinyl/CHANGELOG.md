# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.0.0]() (2026-08-26)

### ⚠ BREAKING CHANGES

- **ad:** AdController.setParentTrack(track) is renamed to
  setAdsProvider(provider) and takes the new AdsProvider interface (getAds()
  plus adsChange) rather than a ReadonlyTrack. A ReadonlyTrack still satisfies
  this structurally, so most call sites need only the method rename.
- **track:** The TrackController currentTrackChange event is removed. Subscribe
  to trackActivated and trackDeactivated (each carrying the track) instead, and
  read the active track via activeTrack (renamed from currentTrack), which
  returns a track only once it is active.
- **streaming:** preferredAudioLanguage now accepts a single tag, an ordered
  list of tags, or null (type widened from string|null to string|readonly
  string[]|null), and null no longer means no preference -- it orders by
  navigator.languages.
- **ad:** The AdController API is reworked around a parent content track. Ad
  discovery is driven by setParentTrack plus async getAds()/adsChange rather
  than pushed ad lists, and the break lifecycle is exposed via
  adBreakEntered/adBreakCompleted.
- **ad:** The AdController currentAdBreakChange event is removed. Subscribe to
  adBreakEntered and adBreakCompleted instead. The content resumePosition moves
  off the per-ad AdCompleteEvent onto AdBreakCompleteEvent.

### Features

- **abr:** add max video resolution restrictions
  ([06b00bf](https://github.com/amazonmusic/vinyl/commits/06b00bf7bd2ac3976e03e6c2ccb4469d81b8d26b))
- **ad:** add adTimeUpdate event with ad and break time remaining
  ([f4020e2](https://github.com/amazonmusic/vinyl/commits/f4020e2611db777ef89b845931d3244dc45028ca))
- **ad:** add HLS SGAI ad interstitials (AdController + TrackController)
  ([aa18318](https://github.com/amazonmusic/vinyl/commits/aa183182304fadffb6b060636610a0430639d387))
- **ad:** ahead-of-time preload for midroll/postroll via adPreload
  ([206f7ec](https://github.com/amazonmusic/vinyl/commits/206f7ec2eb95b7c1ed5091421a66a22181be7a6a))
- **ad:** make the ad-load timeout configurable via player options
  ([4af6d25](https://github.com/amazonmusic/vinyl/commits/4af6d251d69ce190fd74ae2e8a5166d80f8516e7))
- **ad:** preload ad tracks and size the track cache for ads
  ([878e5d0](https://github.com/amazonmusic/vinyl/commits/878e5d0f644bf9fcfe00dfed3dc3eeef27befbd9))
- **ad:** rework ad/track controllers around a parent-track ad model
  ([689512f](https://github.com/amazonmusic/vinyl/commits/689512f65f8f4274ba67137f077c7aa27f2909f8))
- **ad:** split currentAdBreakChange into adBreakEntered/adBreakCompleted;
  resume per break
  ([c378917](https://github.com/amazonmusic/vinyl/commits/c378917bb9888a4bb2cee249fc3df25ac2100b68))
- **ad:** support CUE hints, X-RESUME-OFFSET, and playout limits for HLS
  interstitials
  ([bd3543d](https://github.com/amazonmusic/vinyl/commits/bd3543d64547a60057582849752a583b4efdc1f6))
- **ad:** surface an ad skip window and gate skipping on it
  ([75a2ccd](https://github.com/amazonmusic/vinyl/commits/75a2ccd598b3da5ae4fe4a3d2517b57d142e059b))
- **codec:** add codecOverrides config to force allow/deny codecs
  ([5a5b13b](https://github.com/amazonmusic/vinyl/commits/5a5b13b115bb2bb77d2e465f54c498612e2ebf8c))
- **codec:** recover from decode/append failures via denylist and reload
  ([5203b51](https://github.com/amazonmusic/vinyl/commits/5203b51b1c431cb6b6be862d0ebe8cb72d0a5737))
- **player:** emit track-load span metric events
  ([65a3dae](https://github.com/amazonmusic/vinyl/commits/65a3dae82f775c7308224bfdddc8571eaf8e9010))
- **streaming:** add allowedContentTypes config to restrict media streams
  ([79e51ae](https://github.com/amazonmusic/vinyl/commits/79e51aee80290dcb9242852f6dec8744520cb140))
- **streaming:** add preferDescriptiveAudio opt-in + demo toggle
  ([e255d57](https://github.com/amazonmusic/vinyl/commits/e255d577a924ce5cf5cfe1899359423b2a2b988f))
- **streaming:** support ordered audio-language preferences and fix HLS
  selection
  ([1ed41d2](https://github.com/amazonmusic/vinyl/commits/1ed41d266fb5cf664252a5d2b848fda17d035dfc))
- **text:** auto-select forced captions until the app chooses
  ([0b9f4fc](https://github.com/amazonmusic/vinyl/commits/0b9f4fc446f53f679f1d6fa743c9ab00dcd9a306))
- **text:** configurable VTTCue styling via textCueStyle option
  ([6e665fb](https://github.com/amazonmusic/vinyl/commits/6e665fb9374d466b35050adfc3b3c319dd806fd9))
- **text:** discover and activate sidecar WebVTT text tracks
  ([281c947](https://github.com/amazonmusic/vinyl/commits/281c947722e77a006b8e1ff3ab54543f58f59260))
- **text:** distinguish forced and full text tracks by structured metadata
  ([c7bfe29](https://github.com/amazonmusic/vinyl/commits/c7bfe29dbac6481f078ae325240c6b2e8ac8d78e))
- **text:** select captions by preferred language config
  ([5a7600c](https://github.com/amazonmusic/vinyl/commits/5a7600c383162824bcb48862fbccb58f211e0f45))
- **track:** add a trackEnded event for true track completion
  ([6a4e759](https://github.com/amazonmusic/vinyl/commits/6a4e759fd86b966711c0fb397f209db80b7256fa))
- **website:** settings-menu icons, audio-language fix, descriptive-audio, a11y
  ([6dbec50](https://github.com/amazonmusic/vinyl/commits/6dbec508c1f1a9182d8dd12f500008bfae4c1584))

### Bug Fixes

- **ad:** arm the content-resume gate only when an ad played the break
  ([cc87c30](https://github.com/amazonmusic/vinyl/commits/cc87c30b5c712dcfa96d20eb7848d8e91e9713bf))
- **ad:** cap adTimeUpdate ad total by the break playout limit
  ([0eac5c6](https://github.com/amazonmusic/vinyl/commits/0eac5c6c85ae541e7a7bdc7190c5de76b90c19d4))
- **ad:** clear the content-resume gate only on the content swap, not any seek
  ([7470e06](https://github.com/amazonmusic/vinyl/commits/7470e069e0fa71dd6c081f9a640780ada3b206e4))
- **ad:** key midroll cues off content position after a break ends
  ([0bb68d9](https://github.com/amazonmusic/vinyl/commits/0bb68d91d18e31be35389cc805069dd0cc1d8ece))
- **ad:** play breaks in timeline order and stop postroll replay
  ([c1e4ce8](https://github.com/amazonmusic/vinyl/commits/c1e4ce8d48f59f4aef7d662c2bf8c04c06f6e0a6))
- **ad:** preserve caption selection across ad breaks
  ([6bc9e5d](https://github.com/amazonmusic/vinyl/commits/6bc9e5d5b1b50f46672dd51512e7aa0dd332e624))
- **ad:** resume content at the cue point plus explicit offset only
  ([de17a79](https://github.com/amazonmusic/vinyl/commits/de17a79e73c7e59c95885711893017ec15d48833))
- **dash:** exclude text AdaptationSets from the MSE media pipeline
  ([0d18a65](https://github.com/amazonmusic/vinyl/commits/0d18a65b821afb3e4bc4e3a727d10e7841129c79))
- **drm:** enable ChromeOS verified media path for audio-only content
  ([b9f4b87](https://github.com/amazonmusic/vinyl/commits/b9f4b874e71fb14aa67958e9feb2c5f32b8bfb79))
- **drm:** reuse DRM sessions and reopen buffering across seeks
  ([6fe0aab](https://github.com/amazonmusic/vinyl/commits/6fe0aab11031b76c9e8bb6fe90b1969a62a55a70))
- guard controllers against logging after disposal
  ([17fb657](https://github.com/amazonmusic/vinyl/commits/17fb65714b761f0ed9fa174f0de394f1f21373c8))
- **hls:** resolve each audio rendition's codec from its own variant
  ([855dbe6](https://github.com/amazonmusic/vinyl/commits/855dbe61cf53e2c4d881e8c9ee78f5da590630fa))
- **log:** tag content-typed controllers' logPrefix with audio/video
  ([715f32c](https://github.com/amazonmusic/vinyl/commits/715f32c6074ad755210535ec61974fec85e77ce1))
- **playback:** measure played playbackTime as forward progress per play
  ([b84272f](https://github.com/amazonmusic/vinyl/commits/b84272f19cd4c75f1add352dea4e95adb4695f58))
- **playback:** only reserve the end-of-range seek buffer while playing
  ([1c3ab15](https://github.com/amazonmusic/vinyl/commits/1c3ab15d1c0c26901235ece6b7734b554a6f4853))
- **playback:** prevent a metadata-deferred seek from clobbering a newer seek
  ([e2e01c2](https://github.com/amazonmusic/vinyl/commits/e2e01c25d112625f8658647b6605d90167ea4d5e))
- **seek:** nudge the playhead to recover a stalled seek once all streams have
  data
  ([0f2dc67](https://github.com/amazonmusic/vinyl/commits/0f2dc675646fbdbd87030c9f9224eaf70cf7b025))
- **streaming:** don't default to audio-description renditions
  ([779a7fd](https://github.com/amazonmusic/vinyl/commits/779a7fd2cab011919055e62c79f1bb4fb97a3d27))
- **streaming:** gate audio-description before language selection
  ([6f76b5d](https://github.com/amazonmusic/vinyl/commits/6f76b5dce88ccb94c29d8cbc3a763bd43aad122d))
- **streaming:** skip prefetch error logging after dispose
  ([6b28ee4](https://github.com/amazonmusic/vinyl/commits/6b28ee42139956dd97c951844898151c0b93a088))
- **test:** spy the suite's requester instead of racing a global override
  ([3f35b4c](https://github.com/amazonmusic/vinyl/commits/3f35b4c09f8dd51fc795ea01f7cf45e66fded554))
- **text:** inset caption cue width so it doesn't clip in fullscreen
  ([e8df430](https://github.com/amazonmusic/vinyl/commits/e8df4304e9f891af7b3dfe5c346fd3acb5fb4ad2))
- **text:** re-announce active caption when content resumes after an ad
  ([144ea07](https://github.com/amazonmusic/vinyl/commits/144ea0714d37916965d453c9b72d3ecca5ad0ac8))
- **text:** rebuild the DOM text track across a track suspension
  ([89442ee](https://github.com/amazonmusic/vinyl/commits/89442ee7045a5f4e5fc58315c66aa06d6c15e70f))
- **track:** activate resumed content synchronously after a break
  ([720a1d7](https://github.com/amazonmusic/vinyl/commits/720a1d7a26a921c8a7a3f8efed826138fd7920b2))
- **track:** don't throw DisposedError reading a disposed track's text
  controller
  ([960fea2](https://github.com/amazonmusic/vinyl/commits/960fea2e8071eff5ece6896b90c1e7b7b3ecbbc1))
- **track:** protect an ad break's parent content from eviction
  ([944cb51](https://github.com/amazonmusic/vinyl/commits/944cb51a1de37e9bcb4bc6e140fb5b14e83ee381))

### Reverts

- Revert "fix(ad): key midroll cues off content position after a break ends"
  ([ad111a5](https://github.com/amazonmusic/vinyl/commits/ad111a58ae446b83c974b0090c843d9d34c571fc))
- Revert "fix(ad): arm the content-resume gate only when an ad played the break"
  ([abda02e](https://github.com/amazonmusic/vinyl/commits/abda02ecfcccc9147f71fc97190ae557c4692150))
- Revert "fix(ad): clear the content-resume gate only on the content swap, not
  any seek"
  ([f0c4718](https://github.com/amazonmusic/vinyl/commits/f0c4718d0b3de12f731fdf59fe1e03d4556dae96))

### Code Refactoring

- **ad:** source ad breaks from an AdsProvider interface
  ([23bf40e](https://github.com/amazonmusic/vinyl/commits/23bf40ee5fb60b84c51a8d3b7c655baf25be8ed1))
- **track:** split currentTrackChange into trackActivated/trackDeactivated
  ([3ff29c7](https://github.com/amazonmusic/vinyl/commits/3ff29c762cdcb62efef192d036a1e624bfd4a30d))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0]() (2026-08-26)

### ⚠ BREAKING CHANGES

- **ad:** AdController.setParentTrack(track) is renamed to
  setAdsProvider(provider) and takes the new AdsProvider interface (getAds()
  plus adsChange) rather than a ReadonlyTrack. A ReadonlyTrack still satisfies
  this structurally, so most call sites need only the method rename.
- **track:** The TrackController currentTrackChange event is removed. Subscribe
  to trackActivated and trackDeactivated (each carrying the track) instead, and
  read the active track via activeTrack (renamed from currentTrack), which
  returns a track only once it is active.
- **streaming:** preferredAudioLanguage now accepts a single tag, an ordered
  list of tags, or null (type widened from string|null to string|readonly
  string[]|null), and null no longer means no preference -- it orders by
  navigator.languages.
- **ad:** The AdController API is reworked around a parent content track. Ad
  discovery is driven by setParentTrack plus async getAds()/adsChange rather
  than pushed ad lists, and the break lifecycle is exposed via
  adBreakEntered/adBreakCompleted.
- **ad:** The AdController currentAdBreakChange event is removed. Subscribe to
  adBreakEntered and adBreakCompleted instead. The content resumePosition moves
  off the per-ad AdCompleteEvent onto AdBreakCompleteEvent.

### Features

- **abr:** add max video resolution restrictions
  ([06b00bf](https://github.com/amazonmusic/vinyl/commits/06b00bf7bd2ac3976e03e6c2ccb4469d81b8d26b))
- **ad:** add adTimeUpdate event with ad and break time remaining
  ([f4020e2](https://github.com/amazonmusic/vinyl/commits/f4020e2611db777ef89b845931d3244dc45028ca))
- **ad:** add HLS SGAI ad interstitials (AdController + TrackController)
  ([aa18318](https://github.com/amazonmusic/vinyl/commits/aa183182304fadffb6b060636610a0430639d387))
- **ad:** ahead-of-time preload for midroll/postroll via adPreload
  ([206f7ec](https://github.com/amazonmusic/vinyl/commits/206f7ec2eb95b7c1ed5091421a66a22181be7a6a))
- **ad:** make the ad-load timeout configurable via player options
  ([4af6d25](https://github.com/amazonmusic/vinyl/commits/4af6d251d69ce190fd74ae2e8a5166d80f8516e7))
- **ad:** preload ad tracks and size the track cache for ads
  ([878e5d0](https://github.com/amazonmusic/vinyl/commits/878e5d0f644bf9fcfe00dfed3dc3eeef27befbd9))
- **ad:** rework ad/track controllers around a parent-track ad model
  ([689512f](https://github.com/amazonmusic/vinyl/commits/689512f65f8f4274ba67137f077c7aa27f2909f8))
- **ad:** split currentAdBreakChange into adBreakEntered/adBreakCompleted;
  resume per break
  ([c378917](https://github.com/amazonmusic/vinyl/commits/c378917bb9888a4bb2cee249fc3df25ac2100b68))
- **ad:** support CUE hints, X-RESUME-OFFSET, and playout limits for HLS
  interstitials
  ([bd3543d](https://github.com/amazonmusic/vinyl/commits/bd3543d64547a60057582849752a583b4efdc1f6))
- **ad:** surface an ad skip window and gate skipping on it
  ([75a2ccd](https://github.com/amazonmusic/vinyl/commits/75a2ccd598b3da5ae4fe4a3d2517b57d142e059b))
- **codec:** add codecOverrides config to force allow/deny codecs
  ([5a5b13b](https://github.com/amazonmusic/vinyl/commits/5a5b13b115bb2bb77d2e465f54c498612e2ebf8c))
- **codec:** recover from decode/append failures via denylist and reload
  ([5203b51](https://github.com/amazonmusic/vinyl/commits/5203b51b1c431cb6b6be862d0ebe8cb72d0a5737))
- **player:** emit track-load span metric events
  ([65a3dae](https://github.com/amazonmusic/vinyl/commits/65a3dae82f775c7308224bfdddc8571eaf8e9010))
- **streaming:** add allowedContentTypes config to restrict media streams
  ([79e51ae](https://github.com/amazonmusic/vinyl/commits/79e51aee80290dcb9242852f6dec8744520cb140))
- **streaming:** add preferDescriptiveAudio opt-in + demo toggle
  ([e255d57](https://github.com/amazonmusic/vinyl/commits/e255d577a924ce5cf5cfe1899359423b2a2b988f))
- **streaming:** support ordered audio-language preferences and fix HLS
  selection
  ([1ed41d2](https://github.com/amazonmusic/vinyl/commits/1ed41d266fb5cf664252a5d2b848fda17d035dfc))
- **text:** auto-select forced captions until the app chooses
  ([0b9f4fc](https://github.com/amazonmusic/vinyl/commits/0b9f4fc446f53f679f1d6fa743c9ab00dcd9a306))
- **text:** configurable VTTCue styling via textCueStyle option
  ([6e665fb](https://github.com/amazonmusic/vinyl/commits/6e665fb9374d466b35050adfc3b3c319dd806fd9))
- **text:** discover and activate sidecar WebVTT text tracks
  ([281c947](https://github.com/amazonmusic/vinyl/commits/281c947722e77a006b8e1ff3ab54543f58f59260))
- **text:** distinguish forced and full text tracks by structured metadata
  ([c7bfe29](https://github.com/amazonmusic/vinyl/commits/c7bfe29dbac6481f078ae325240c6b2e8ac8d78e))
- **text:** select captions by preferred language config
  ([5a7600c](https://github.com/amazonmusic/vinyl/commits/5a7600c383162824bcb48862fbccb58f211e0f45))
- **track:** add a trackEnded event for true track completion
  ([6a4e759](https://github.com/amazonmusic/vinyl/commits/6a4e759fd86b966711c0fb397f209db80b7256fa))
- **website:** settings-menu icons, audio-language fix, descriptive-audio, a11y
  ([6dbec50](https://github.com/amazonmusic/vinyl/commits/6dbec508c1f1a9182d8dd12f500008bfae4c1584))

### Bug Fixes

- **ad:** arm the content-resume gate only when an ad played the break
  ([cc87c30](https://github.com/amazonmusic/vinyl/commits/cc87c30b5c712dcfa96d20eb7848d8e91e9713bf))
- **ad:** cap adTimeUpdate ad total by the break playout limit
  ([0eac5c6](https://github.com/amazonmusic/vinyl/commits/0eac5c6c85ae541e7a7bdc7190c5de76b90c19d4))
- **ad:** clear the content-resume gate only on the content swap, not any seek
  ([7470e06](https://github.com/amazonmusic/vinyl/commits/7470e069e0fa71dd6c081f9a640780ada3b206e4))
- **ad:** key midroll cues off content position after a break ends
  ([0bb68d9](https://github.com/amazonmusic/vinyl/commits/0bb68d91d18e31be35389cc805069dd0cc1d8ece))
- **ad:** play breaks in timeline order and stop postroll replay
  ([c1e4ce8](https://github.com/amazonmusic/vinyl/commits/c1e4ce8d48f59f4aef7d662c2bf8c04c06f6e0a6))
- **ad:** preserve caption selection across ad breaks
  ([6bc9e5d](https://github.com/amazonmusic/vinyl/commits/6bc9e5d5b1b50f46672dd51512e7aa0dd332e624))
- **ad:** resume content at the cue point plus explicit offset only
  ([de17a79](https://github.com/amazonmusic/vinyl/commits/de17a79e73c7e59c95885711893017ec15d48833))
- **dash:** exclude text AdaptationSets from the MSE media pipeline
  ([0d18a65](https://github.com/amazonmusic/vinyl/commits/0d18a65b821afb3e4bc4e3a727d10e7841129c79))
- **drm:** enable ChromeOS verified media path for audio-only content
  ([b9f4b87](https://github.com/amazonmusic/vinyl/commits/b9f4b874e71fb14aa67958e9feb2c5f32b8bfb79))
- **drm:** reuse DRM sessions and reopen buffering across seeks
  ([6fe0aab](https://github.com/amazonmusic/vinyl/commits/6fe0aab11031b76c9e8bb6fe90b1969a62a55a70))
- guard controllers against logging after disposal
  ([17fb657](https://github.com/amazonmusic/vinyl/commits/17fb65714b761f0ed9fa174f0de394f1f21373c8))
- **hls:** resolve each audio rendition's codec from its own variant
  ([855dbe6](https://github.com/amazonmusic/vinyl/commits/855dbe61cf53e2c4d881e8c9ee78f5da590630fa))
- **log:** tag content-typed controllers' logPrefix with audio/video
  ([715f32c](https://github.com/amazonmusic/vinyl/commits/715f32c6074ad755210535ec61974fec85e77ce1))
- **playback:** measure played playbackTime as forward progress per play
  ([b84272f](https://github.com/amazonmusic/vinyl/commits/b84272f19cd4c75f1add352dea4e95adb4695f58))
- **playback:** only reserve the end-of-range seek buffer while playing
  ([1c3ab15](https://github.com/amazonmusic/vinyl/commits/1c3ab15d1c0c26901235ece6b7734b554a6f4853))
- **playback:** prevent a metadata-deferred seek from clobbering a newer seek
  ([e2e01c2](https://github.com/amazonmusic/vinyl/commits/e2e01c25d112625f8658647b6605d90167ea4d5e))
- **seek:** nudge the playhead to recover a stalled seek once all streams have
  data
  ([0f2dc67](https://github.com/amazonmusic/vinyl/commits/0f2dc675646fbdbd87030c9f9224eaf70cf7b025))
- **streaming:** don't default to audio-description renditions
  ([779a7fd](https://github.com/amazonmusic/vinyl/commits/779a7fd2cab011919055e62c79f1bb4fb97a3d27))
- **streaming:** gate audio-description before language selection
  ([6f76b5d](https://github.com/amazonmusic/vinyl/commits/6f76b5dce88ccb94c29d8cbc3a763bd43aad122d))
- **streaming:** skip prefetch error logging after dispose
  ([6b28ee4](https://github.com/amazonmusic/vinyl/commits/6b28ee42139956dd97c951844898151c0b93a088))
- **test:** spy the suite's requester instead of racing a global override
  ([3f35b4c](https://github.com/amazonmusic/vinyl/commits/3f35b4c09f8dd51fc795ea01f7cf45e66fded554))
- **text:** inset caption cue width so it doesn't clip in fullscreen
  ([e8df430](https://github.com/amazonmusic/vinyl/commits/e8df4304e9f891af7b3dfe5c346fd3acb5fb4ad2))
- **text:** re-announce active caption when content resumes after an ad
  ([144ea07](https://github.com/amazonmusic/vinyl/commits/144ea0714d37916965d453c9b72d3ecca5ad0ac8))
- **text:** rebuild the DOM text track across a track suspension
  ([89442ee](https://github.com/amazonmusic/vinyl/commits/89442ee7045a5f4e5fc58315c66aa06d6c15e70f))
- **track:** activate resumed content synchronously after a break
  ([720a1d7](https://github.com/amazonmusic/vinyl/commits/720a1d7a26a921c8a7a3f8efed826138fd7920b2))
- **track:** don't throw DisposedError reading a disposed track's text
  controller
  ([960fea2](https://github.com/amazonmusic/vinyl/commits/960fea2e8071eff5ece6896b90c1e7b7b3ecbbc1))
- **track:** protect an ad break's parent content from eviction
  ([944cb51](https://github.com/amazonmusic/vinyl/commits/944cb51a1de37e9bcb4bc6e140fb5b14e83ee381))

### Reverts

- Revert "fix(ad): key midroll cues off content position after a break ends"
  ([ad111a5](https://github.com/amazonmusic/vinyl/commits/ad111a58ae446b83c974b0090c843d9d34c571fc))
- Revert "fix(ad): arm the content-resume gate only when an ad played the break"
  ([abda02e](https://github.com/amazonmusic/vinyl/commits/abda02ecfcccc9147f71fc97190ae557c4692150))
- Revert "fix(ad): clear the content-resume gate only on the content swap, not
  any seek"
  ([f0c4718](https://github.com/amazonmusic/vinyl/commits/f0c4718d0b3de12f731fdf59fe1e03d4556dae96))

### Code Refactoring

- **ad:** source ad breaks from an AdsProvider interface
  ([23bf40e](https://github.com/amazonmusic/vinyl/commits/23bf40ee5fb60b84c51a8d3b7c655baf25be8ed1))
- **track:** split currentTrackChange into trackActivated/trackDeactivated
  ([3ff29c7](https://github.com/amazonmusic/vinyl/commits/3ff29c762cdcb62efef192d036a1e624bfd4a30d))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.2.0]() (2026-07-02)

### Features

- **abr:** add maxBandwidth restriction to ABR options
  ([ffd1831](https://github.com/amazonmusic/vinyl/commits/ffd183118a6b0db010435d05ddd850ae64fc5e79))
- **hls-parser:** substitute EXT-X-DEFINE variables in multivariant URIs
  ([1172183](https://github.com/amazonmusic/vinyl/commits/1172183293a9d31f9a598b01c0a44bcb92efe4eb))
- **vinyl:** expose resetPending state on VinylPlayer
  ([100dc4a](https://github.com/amazonmusic/vinyl/commits/100dc4a1be28426d0fb1773245e2700a93b78880))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.1.1]() (2026-05-28)

**Note:** Version bump only for package @amazon/vinyl

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
- remove getSlotAtTime affordance
  ([27207e5](https://github.com/amazonmusic/vinyl/commits/27207e56d90e6621493238f1185020c364bdcaf7))
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
