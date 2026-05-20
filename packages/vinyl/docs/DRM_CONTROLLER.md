# DRM Controller

Encrypted Media Extensions (EME) are a set of web APIs that enable web browsers
to play protected video and audio content. They work by allowing the browser to
communicate with digital rights management (DRM) systems, which manage the
decryption keys needed to play the content securely.

Amazon Vinyl currently supports Widevine (Chrome, Edge Chromium, Firefox),
FairPlay (Safari, iOS), and PlayReady (Edge).

For DRM configuration examples and usage guide, see
[DRM Configuration](./DRM_CONFIGURATION.md).

## Encrypted Media Extensions

```
  +--------------------------------+       +---------------------------+
  | Encrypted media is parsed      |       | Streaming Quality Changed |
  | (e.g. PSSH box from moov atom) |       +---------------------------+
  +--------------------------------+                 |
           |                                         |
           v                                         v
  +-------------------+                   +-------------------------+
  | media element     |                   | Manifest has PSSH data? |
  | 'encrypted' event |                   +-------------------------+
  +-------------------+                              |
           |                                         |
           v                                         v
  +----------------------------------------------------------+
  | Create and attach Media Keys (first time as needed)      |
  |                                                          |
  |     +---------------------------------------+            |
  |     | navigator.requestMediaKeySystemAccess |            |
  |     +---------------------------------------+            |
  |                   |                                      |
  |                   v                                      |
  |     +-------------------------------+                    |
  |     | MediaKeySystemAccess          |                    |
  |     | access.createMediaKeys        |                    |
  |     +-------------------------------+                    |
  |                   |                                      |
  |                   v                                      |
  |     +---------------------------+                        |
  |     |         MediaKeys         |                        |
  |     | mediaElement.setMediaKeys |                        |
  |     +---------------------------+                        |
  |               |                                          |
  +----------------------------------------------------------+
                  |
                  v
     +----------------------------+
     | mediaKeys.createSession    |
     | (when session for PSSH key |
     |  does not exist            |
     +----------------------------+
                  |
                  v
     +--------------------------+
     | session.generateRequest  |
     +--------------------------+
                  |
                  v
     +---------------------------+
     | MediaKeySession 'message' |
     | event                     |
     |                           |
     +---------------------------+
                    |
                    |  license challenge
                    v
      +-------------------------------------+
      | request license                     |
      | (e.g. DMLS.getLicenseForPlayback)   |
      +-------------------------------------+
                    |
                    v
      +---------------------------+
      | license response          |
      +---------------------------+
                    |
                    v
      +---------------------------+
      | mediaKeySession.update    |
      +---------------------------+
```

# Implementation

## CommonEme

CommonEme is a ponyfill abstraction layer to EME implementations. It is to
provide a common implementation between post-2017 w3c “standard” media keys and
prefixed vendor-specific EME implementations such as MSMediaKeys and
WebKitMediaKeys.

The simplified interface:

```
CommonEme
    requestMediaKeySystemAccess -> CommonMediaKeySystemAccess

CommonMediaKeySystemAccess
    createMediaKeys(): Promise<CommonMediaKeys>

CommonMediaKeys
    createSession(): CommonMediaKeySession
    setOnElement()
    clearFromElement()

CommonMediaKeySession
    generateRequest
    update
```

A ponyfill has advantages over a polyfill in that only the necessary parts need
to be implemented. There is no “uncanny valley” or complicated branching for
feature detection with a ponyfill.

The implementation of CommonEme used will be based on a heuristic querying which
system is supported.

## DrmController

DrmController is responsible for initiating and managing active key session(s).
It sets media keys on the media element and initiates key systems based on the
track’s encryption settings. It must allow session switching when changing
between adaptation sets with separate licenses.

DrmController has a dependency on a CommonEme implementation, the media element,
and configuration providers.

To create media key system access, we need a key system and
`MediaKeySystemConfiguration` list. The configuration determines, among other
things, which CDM robustness to use (hardware or software decryption), and
whether to use persistent licenses. The track itself knows which key systems are
supported. For Dash tracks this comes from ContentProtection elements, and for
HLS we know this to always be Fairplay, but in the future when supporting MSE
HLS we may read the EXT-X-KEY tag in the media playlist.

In Dash, the scheme id list provided will be the inherited ContentProtection
element scheme ids.

To build the key system configuration, information is gathered from the track
and inherits configuration provided by the player.

## Track vs Group Licenses

Web playback does not support group licenses; every track must have its own
license.
