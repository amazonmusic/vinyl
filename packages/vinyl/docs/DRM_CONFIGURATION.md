# DRM Configuration

This guide covers how to configure DRM (Digital Rights Management) settings in
Amazon Vinyl for both player-level and track-level configurations.

## DRM Player Configuration

Configure DRM settings at the player level for default behavior across all
tracks:

```typescript
import { createVinylPlayer, DrmKeySystem, DrmRobustness } from '@amazon/vinyl'

createVinylPlayer({
    media: new Audio(),
    drm: {
        keySystems: {
            [DrmKeySystem.WIDEVINE]: {
                licenseServer: async () => {
                    return {
                        url: 'https://cwip-shaka-proxy.appspot.com/no_auth',
                        init: {
                            headers: { Authorization: await getAuthToken() },
                        },
                    }
                },
                video: {
                    // Default is SW_SECURE_CRYPTO (L3), may be changed to HW_SECURE_ALL (L1) on devices with support.
                    robustness: DrmRobustness.HW_SECURE_ALL,
                },
                audio: {
                    robustness: DrmRobustness.HW_SECURE_ALL,
                },
                priority: 1,
            },
            [DrmKeySystem.PLAY_READY]: {
                licenseServer: {
                    url: 'http://test.playready.microsoft.com/service/rightsmanager.asmx',
                },
            },
        },
    },
})
```

## Wildcard Key System Configuration

You can configure a wildcard (`'*'`) key system that will be used as a fallback
when no specific key system matches. This is useful for providing default DRM
settings that apply to any unrecognized key systems.

```typescript
import { createVinylPlayer, DrmKeySystem, DrmRobustness } from '@amazon/vinyl'

createVinylPlayer({
    media: new Audio(),
    drm: {
        keySystems: {
            [DrmKeySystem.WIDEVINE]: {
                licenseServer: {
                    url: 'https://widevine-license-server.com/license',
                },
            },
            // Wildcard fallback for any other key systems
            '*': {
                licenseServer: {
                    url: 'https://generic-license-server.com/license',
                },
                video: {
                    robustness: DrmRobustness.SW_SECURE_CRYPTO,
                },
                audio: {
                    robustness: DrmRobustness.SW_SECURE_CRYPTO,
                },
            },
        },
    },
})
```

## Robustness

DRM has 3 possible tiers of security:

1. **L1 (Level 1) - `HW_SECURE_ALL`** - L1 DRM offers the highest level of
   security for content protection. This tier typically involves both the
   decryption of media content and the execution of DRM code within a secure
   hardware environment, such as a Trusted Execution Environment (TEE). L1
   requires hardware-based security features. The decryption and processing of
   media content occur in a secure, isolated part of the hardware, preventing
   exposure to the operating system or software layers.

2. **L2 (Level 2) - `HW_SECURE_CRYPTO`, `HW_SECURE_DECODE`** - L2 DRM provides a
   middle ground between security and flexibility. In this tier, the DRM code
   may still execute in a secure environment, but media decryption can happen in
   the software layer, although still within a protected memory region. This
   tier offers a compromise between robust security and broader device
   compatibility.

3. **L3 (Level 3) - `SW_SECURE_CRYPTO`, `SW_SECURE_DECODE`** - L3 DRM is the
   most basic security tier, where both the DRM code execution and media
   decryption occur entirely in software, without relying on hardware-based
   security. No special hardware security features are required, and all
   operations are handled in the application and operating system software
   layers.

## Track-Level DRM Override

Tracks can override DRM settings on a per-track basis using the `drm` property
in track load options. This allows customizing license providers, key systems,
and other DRM settings for individual tracks.

```typescript
import { createVinylPlayer, DrmKeySystem } from '@amazon/vinyl'

const player = createVinylPlayer({ media: new Audio() })

player.load({
    type: 'dash',
    uri: 'https://example.com/encrypted-track.mpd',
    drm: {
        licenseProvider: async (keySystem, serverOptions, challenge) => {
            // Custom license provider logic
            // To change request options such as url or request parameters,
            // a custom license provider isn't needed; see licenseServer
            // configuration
            const response = await fetch(serverOptions.url, {
                method: 'POST',
                body: challenge,
                headers: { 'Content-Type': 'application/octet-stream' },
            })
            return response.arrayBuffer()
        },
        keySystems: {
            [DrmKeySystem.WIDEVINE]: {
                licenseServer: {
                    url: 'https://custom-license-server.com/widevine',
                    init: {
                        headers: { Authorization: 'Bearer token123' },
                    },
                },
            },
        },
    },
})
```

### ValueProvider Formats

License server configuration supports three ValueProvider formats:

**Direct Value**: Provide the configuration object directly

```typescript
import { DrmKeySystemOptions } from '@amazon/vinyl'

const options: DrmKeySystemOptions = {
    licenseServer: {
        url: 'https://license-server.com/endpoint',
        init: { headers: { Authorization: 'Bearer token' } },
    },
}
```

**Synchronous Function**: Return configuration from a function

```typescript
import { DrmKeySystemOptions } from '@amazon/vinyl'

const options: DrmKeySystemOptions = {
    licenseServer: () => ({
        url: getConfiguredLicenseUrl(),
        init: { headers: { Authorization: getCurrentToken() } },
    }),
}
```

**Async Function**: Return a Promise resolving to configuration

```typescript
import { DrmKeySystemOptions } from '@amazon/vinyl'

const options: DrmKeySystemOptions = {
    licenseServer: async () => {
        const token = await fetchAuthToken()
        return {
            url: 'https://license-server.com/endpoint',
            init: { headers: { Authorization: `Bearer ${token}` } },
        }
    },
}
```

## Content Protection Selection

When a manifest is parsed, representations are filtered out if they do not
contain a supported key system (`DrmController.isSupported`). If content is
encrypted with multiple key systems supported by the system, the one chosen will
be prioritized first by the `priority` value in the configuration (higher values
take precedence, default priority is `0`), then by the existence of a set
`licenseServer` configuration, and lastly by the order found within the
manifest.

Dash manifests contains content protection elements with scheme ids. These are
resolved to key system(s) by a key system resolver
`(schemeIdUri: string) => readonly DrmKeySystem[]` which may be changed by
overriding the `drmKeySystemResolver` dependency when constructing a player. The
default resolver provides all known key systems for the given scheme.

## Persistent Licenses

Amazon Vinyl does not yet support persistent licenses.

## Track vs Group Licenses

Web playback does not support group licenses; every track must have its own
license.
