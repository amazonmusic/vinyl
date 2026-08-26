/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import { supportsMse, type VinylPlayer } from '@amazon/vinyl'
import { poll } from '@amazon/vinyl-util'

/**
 * Integration tests for `preferredAudioLanguage` over HLS.
 *
 * The `vinyl_ad_breaks_av` asset carries five demuxed audio renditions
 * (es-ES, de-DE, fr-FR, en-US, ja-JP), and its native single-URI interstitials
 * point at ad clips that carry the *same* five languages. So a single asset
 * lets us assert the selected audio language on both the content track and the
 * ad track, and that changing the preference mid-playback immediately reloads
 * (hard-resets) the track — clearing buffers the way other streaming-config
 * changes do — and resumes in the newly-preferred language at the same playhead.
 *
 * Selecting a language removes the other-language audio qualities from the
 * timeline before ABR, so `player.qualities` exposes only the kept language(s):
 * asserting on it is deterministic and does not depend on which rendition ABR
 * happens to pick. During an ad break the ad track is `activeTrack`, so the
 * same getter reflects the ad's (filtered) audio qualities.
 */
describe('preferredAudioLanguage HLS integ', () => {
    // Native multi-language AV asset with a real single-URI pre/mid/post
    // interstitial set (content and each ad clip share the five languages).
    const ASSET =
        vinylTestAssets.hls.vinyl_ad_breaks_av__single_uri_pre_mid_post

    // Ad switching aborts in-flight content seek/append operations, which
    // surface as benign silent AbortErrors; don't fail the suite on errors.
    const suite = createVinylSuite({}, { timeout: 180, failOnError: false })

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    /** The languages of the current track's available audio qualities. */
    function audioLangs(player: VinylPlayer): (string | null)[] {
        return (player.qualities ?? [])
            .filter((q) => q.contentType === 'audio')
            .map((q) => q.lang)
    }

    /** True once the current track exposes only `lang`-prefixed audio. */
    function audioIsOnly(player: VinylPlayer, lang: string): boolean {
        const langs = audioLangs(player)
        return (
            langs.length > 0 &&
            langs.every((l) => l != null && l.toLowerCase().startsWith(lang))
        )
    }

    /**
     * Seeks, tolerating the benign AbortError that occurs when the seek lands
     * inside an ad break and the ad immediately takes over the media element.
     */
    async function seekTolerant(time: number): Promise<void> {
        try {
            await suite.player.seekTo(time, 0.5)
        } catch {
            // Seeking into a break aborts the content seek — expected.
        }
    }

    /**
     * Loads the asset with the given preference, plays, and waits until the
     * ad breaks are discovered and content audio is filtered to `lang`.
     * Playing before seeking is required on iOS Safari (a cold seek hangs).
     */
    async function loadAndPlay(
        preferredAudioLanguage: string | readonly string[],
        lang: string
    ): Promise<void> {
        const player = suite.player
        player.configure({ preferredAudioLanguage })
        player.load({ type: 'hls', uri: ASSET })
        await player.play().catch(() => undefined)
        expect(
            await poll(
                () => (player.currentTrackAds?.adBreaks.length ?? 0) > 0,
                { timeout: 30 }
            )
        )
            .withContext('ad breaks discovered')
            .toBeTrue()
        expect(await poll(() => audioIsOnly(player, lang), { timeout: 30 }))
            .withContext(`content audio filtered to '${lang}'`)
            .toBeTrue()
    }

    /** The start time of the first midroll break, once discovered. */
    function midrollStart(player: VinylPlayer): number {
        const midroll = player.currentTrackAds?.adBreaks.find(
            (b) => b.placement === 'midroll'
        )
        return midroll!.startTime
    }

    it('plays the preferred language for both content and ad audio', async () => {
        const player = suite.player
        await loadAndPlay('ja', 'ja')

        // Seek into the midroll; the ad track becomes current and its audio is
        // filtered to the same preference (proving the preference applies to ad
        // tracks, not just content).
        await seekTolerant(midrollStart(player) + 1)
        expect(await poll(() => player.currentAd != null, { timeout: 40 }))
            .withContext('ad playing')
            .toBeTrue()
        expect(await poll(() => audioIsOnly(player, 'ja'), { timeout: 30 }))
            .withContext(`ad audio filtered to 'ja'`)
            .toBeTrue()
    })

    it('immediately reloads and switches language when the preference changes', async () => {
        const player = suite.player
        await loadAndPlay('ja', 'ja')

        // Let content play a little so there is a real playhead and buffered
        // media to be cleared by the reload.
        expect(await poll(() => player.currentTime > 1, { timeout: 30 }))
            .withContext('content advanced')
            .toBeTrue()
        const resumeBefore = player.currentTime

        // Changing the preference hard-resets the track in place (clearing
        // buffers, like other streaming-config changes) and re-filters audio.
        player.configure({ preferredAudioLanguage: 'de' })
        expect(await poll(() => audioIsOnly(player, 'de'), { timeout: 30 }))
            .withContext(`content audio switched to 'de'`)
            .toBeTrue()

        // The reloaded track resumes at the prior playhead and keeps playing
        // (proving the reload recovered rather than stranding playback).
        expect(
            await poll(
                () => !player.paused && player.currentTime >= resumeBefore,
                { timeout: 40 }
            )
        )
            .withContext('resumed playing at the prior playhead')
            .toBeTrue()
    })

    it('accepts an ordered array preference, using a later entry when earlier ones are absent', async () => {
        const player = suite.player
        // 'ko' is not available; the next preference 'de' wins.
        await loadAndPlay(['ko', 'de'], 'de')
        expect(audioIsOnly(player, 'de'))
            .withContext(`content audio resolved to 'de' from the array`)
            .toBeTrue()
    })
})
