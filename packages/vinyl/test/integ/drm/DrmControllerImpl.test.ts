/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    clearServiceCertificateCache,
    createVinylPlayer,
    defaultLicenseProvider,
    DrmKeySystem,
    type DrmKeyStatusesChangeEvent,
    isWidevineServiceCertificateRequest,
    type LicenseProvider,
    type VinylPlayer,
    type VinylTrackLoadOptions,
} from '@amazon/vinyl'
import {
    createVinylSuite,
    expectTrackPlays,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'
import { pendingIfWidevineNotSupported } from './pendingIfWidevineNotSupported'

describe('DrmControllerImpl integ', () => {
    const vinylSuite = createVinylSuite({
        drm: {
            keySystems: {
                [DrmKeySystem.WIDEVINE]: {
                    licenseServer: {
                        url: 'https://cwip-shaka-proxy.appspot.com/no_auth',
                    },
                },
            },
        },
    })

    beforeEach(async () => {
        await pendingIfWidevineNotSupported(vinylSuite.player)
    })

    describe('when given dash widevine', () => {
        it('emits a usable keyStatusesChange on the player', async () => {
            const keyStatusesChange = new Promise<DrmKeyStatusesChangeEvent>(
                (resolve) =>
                    vinylSuite.player.on('keyStatusesChange', (event) => {
                        if (
                            event.keyStatuses.some(
                                ({ status }) => status === 'usable'
                            )
                        )
                            resolve(event)
                    })
            )
            vinylSuite.player.load({
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase_widevine,
            })
            await vinylSuite.player.play()
            const event = await keyStatusesChange
            expect(event.keySystem).toBe(DrmKeySystem.WIDEVINE)
            expect(event.keyStatuses[0]?.keyId.byteLength).toBe(16)
        })

        it('plays', async () => {
            vinylSuite.player.load({
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase_widevine,
            })
            await vinylSuite.player.play()
            await expectTrackPlays(vinylSuite.player)
        })
    })
})

describe('DrmControllerImpl integ when preferPrefixedMediaKeys is true', () => {
    const prefixedSuite = createVinylSuite({
        drm: {
            keySystems: {
                [DrmKeySystem.WIDEVINE]: {
                    licenseServer: {
                        url: 'https://cwip-shaka-proxy.appspot.com/no_auth',
                    },
                },
            },
            preferPrefixedMediaKeys: true,
        },
    })

    beforeEach(async () => {
        await pendingIfWidevineNotSupported(prefixedSuite.player)
    })

    // Widevine is only available through standard EME, so preferring
    // prefixed EME must still fall back to it and play.
    it('plays dash widevine', async () => {
        prefixedSuite.player.load({
            type: 'dash',
            uri: vinylTestAssets.dash
                .live_static_aac_opus_flac_60s_segmentBase_widevine,
        })
        await prefixedSuite.player.play()
        await expectTrackPlays(prefixedSuite.player)
    })
})

describe('DrmControllerImpl integ Widevine service certificate', () => {
    const licenseUrl = 'https://cwip-shaka-proxy.appspot.com/no_auth'
    let certificateRequests = 0
    let licenseRequests = 0

    // Counts the CDM's service certificate requests and its license requests.
    const licenseProvider: LicenseProvider = (
        keySystem,
        serverOptions,
        challenge,
        abort
    ) => {
        if (isWidevineServiceCertificateRequest(keySystem, challenge)) {
            certificateRequests++
        } else {
            licenseRequests++
        }
        return defaultLicenseProvider(
            keySystem,
            serverOptions,
            challenge,
            abort
        )
    }

    const drm = {
        keySystems: {
            [DrmKeySystem.WIDEVINE]: { licenseServer: { url: licenseUrl } },
        },
        licenseProvider,
    }
    const vinylSuite = createVinylSuite({ drm })

    const audioTrack: VinylTrackLoadOptions = {
        type: 'dash',
        uri: vinylTestAssets.dash
            .live_static_aac_opus_flac_60s_segmentBase_widevine,
    }
    const videoTrack: VinylTrackLoadOptions = {
        type: 'dash',
        uri: vinylTestAssets.dash
            .live_static_video_audio_60s_2s_segmentTemplate_widevine_cl10,
    }

    async function playTrack(
        player: VinylPlayer,
        track: VinylTrackLoadOptions
    ) {
        player.load(track)
        await player.play()
        await expectTrackPlays(player)
    }

    beforeEach(async () => {
        clearServiceCertificateCache()
        certificateRequests = 0
        licenseRequests = 0
        await pendingIfWidevineNotSupported(vinylSuite.player)
    })

    afterEach(() => clearServiceCertificateCache())

    it("requests the service certificate once for a player's tracks", async () => {
        await playTrack(vinylSuite.player, audioTrack)
        const firstTrackLicenses = licenseRequests
        await playTrack(vinylSuite.player, videoTrack)

        // The second track's sessions requested licenses of their own...
        expect(licenseRequests).toBeGreaterThan(firstTrackLicenses)
        // ...but only the first session asked for the certificate.
        expect(certificateRequests).toBe(1)
    })

    it('shares the service certificate with another player', async () => {
        await playTrack(vinylSuite.player, audioTrack)
        expect(certificateRequests).toBe(1)
        vinylSuite.player.pause()

        const media = document.createElement('video')
        media.muted = true
        const player = createVinylPlayer({ media, drm })
        try {
            await playTrack(player, videoTrack)
        } finally {
            player.dispose()
        }

        expect(certificateRequests).toBe(1)
    })
})
