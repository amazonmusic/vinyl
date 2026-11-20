import type { JsxElementProps } from '@amazon/vinyl-tsx'
import { jsx } from '@amazon/vinyl-tsx'
import {
    playerState,
    captionRenderer,
    seekToPercent,
    skipAd,
    togglePlayPause,
    unloadTrack,
} from '../player'
import type { LogTarget } from '@amazon/vinyl-util'
import { logDebug } from '@amazon/vinyl-util'
import { combineData } from '@amazon/vinyl-observable'
import { Icon } from './icons'
import { LIVE_DURATION } from '@amazon/vinyl'
import { ScrubBar } from './ScrubBar'
import { VolumeControl } from './VolumeControl'
import { SettingsControl } from './SettingsControl'
import { HIDE_CONTROLS_MS, pipMode$, registerPipStage } from '../pip'

const target: LogTarget = {
    logPrefix: 'TransportBar',
}

/**
 * Props for the transport bar's root element. `className` and `onConnect` are
 * set by the transport bar itself, so they're omitted to keep the spread props
 * from overwriting them.
 */
export type TransportBarProps = Omit<
    JsxElementProps<'footer'>,
    'className' | 'onConnect'
>

export function TransportBar(props: TransportBarProps) {
    const {
        player,
        media,
        currentTime$,
        currentTimePercent$,
        duration$,
        fetchedTimePercent$,
        loading$,
        paused$,
        track$,
        volume$,
        muted$,
        hasVideo$,
        currentAdBreak$,
        adBreaks$,
        adTimeRemaining$,
        canSkipAd$,
        skipIn$,
        seekRange$,
        currentAdIndex$,
    } = playerState

    const adBreakActive$ = currentAdBreak$.map((b) => b != null)
    // A stitched (SSAI) break plays within the content timeline, so the scrub
    // bar stays; an interstitial replaces the content track, so it is hidden.
    const interstitialActive$ = currentAdBreak$.map(
        (b) => b != null && b.insertion !== 'stitched'
    )
    const adRemainingLabel$ = adTimeRemaining$.map(formatTime)
    // The ad controller decides skippability (respecting the skip window and any
    // restriction); until the window opens, show a countdown instead of a button.
    const skipCountdown$ = skipIn$.map((s) =>
        s != null && s > 0 ? `Skip in ${Math.ceil(s)}s` : ''
    )
    const showSkipCountdown$ = skipIn$.map((s) => s != null && s > 0)
    const adLabel$ = currentAdIndex$.map((v) => {
        if (v.totalAds <= 1) return 'Ad'
        return `Ad ${v.index + 1} / ${v.totalAds}`
    })

    const elapsed$ = currentTime$.map(formatTime)
    const remaining$ = currentTime$.map((t) => {
        const dur = duration$.value
        return dur > 0 && dur < LIVE_DURATION ? '-' + formatTime(dur - t) : ''
    })

    media.addEventListener('click', togglePlayPause)

    // In Document PiP the stage's children live in the PiP window, so the
    // emptied stage hides. In element PiP the video stays rendered but moves
    // off screen ('pipOffscreen'): WebKit only paints captions into its PiP
    // window, and only attaches a new source's video (after an ad switches
    // tracks) to it, while the element has a layout box.
    const showVideo$ = combineData({ hasVideo: hasVideo$, pip: pipMode$ }).map(
        ({ hasVideo, pip }) => {
            logDebug(target, 'show video', 'hasVideo:', hasVideo, 'pip', pip)
            return hasVideo && pip !== 'document'
        }
    )

    const resizeObserver = new ResizeObserver((entries) => {
        if (!entries.length) return
        const entry = entries[0]
        const height = entry.target.clientHeight
        document.documentElement.style.setProperty(
            '--transport-height',
            `${height}px`
        )
    })

    // The transport root, so fullscreen covers the video AND the custom controls
    // (fullscreening the bare video would hide them and show native controls).
    let root: HTMLElement | null = null

    function toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
        } else {
            root?.requestFullscreen().catch(() => {})
        }
    }

    return (
        <footer
            className="transport"
            onConnect={(element) => {
                root = element
                resizeObserver.observe(element)

                // In fullscreen, keep the custom controls visible but auto-hide
                // them after a period without user interaction (each interaction
                // debounces the hide by restarting the timer). The `controlsHidden`
                // class also drives the caption overlay's bottom inset (CSS).
                let hideTimer: ReturnType<typeof setTimeout> | undefined
                const hideControls = () =>
                    element.classList.add('controlsHidden')
                const showControls = () => {
                    element.classList.remove('controlsHidden')
                    clearTimeout(hideTimer)
                    if (document.fullscreenElement === element) {
                        hideTimer = setTimeout(hideControls, HIDE_CONTROLS_MS)
                    }
                }
                const onFullscreenChange = () => {
                    if (document.fullscreenElement === element) {
                        showControls()
                    } else {
                        clearTimeout(hideTimer)
                        element.classList.remove('controlsHidden')
                    }
                }
                element.addEventListener('pointermove', showControls)
                element.addEventListener('pointerdown', showControls)
                element.addEventListener('keydown', showControls)
                document.addEventListener(
                    'fullscreenchange',
                    onFullscreenChange
                )

                return () => {
                    root = null
                    resizeObserver.unobserve(element)
                    clearTimeout(hideTimer)
                    element.removeEventListener('pointermove', showControls)
                    element.removeEventListener('pointerdown', showControls)
                    element.removeEventListener('keydown', showControls)
                    document.removeEventListener(
                        'fullscreenchange',
                        onFullscreenChange
                    )
                    document.documentElement.style.setProperty(
                        '--transport-height',
                        '0px'
                    )
                }
            }}
            {...props}
        >
            <div
                className="transportVideo"
                visible={showVideo$}
                onConnect={(element) => {
                    registerPipStage(element)
                    const unPip = pipMode$.onData((mode) =>
                        element.classList.toggle(
                            'pipOffscreen',
                            mode === 'element'
                        )
                    )
                    return () => {
                        unPip()
                        registerPipStage(null)
                    }
                }}
            >
                {media}
                {captionRenderer.element}
                <div className="adOverlay" visible={adBreakActive$}>
                    <span className="adBadge">{adLabel$}</span>
                    <span className="adRemaining">{adRemainingLabel$}</span>
                    <span
                        className="adSkipCountdown"
                        visible={showSkipCountdown$}
                    >
                        {skipCountdown$}
                    </span>
                    <button
                        className="adSkipBtn"
                        visible={canSkipAd$}
                        onclick={skipAd}
                    >
                        Skip Ad
                    </button>
                </div>
                {/* Shown only in a Document Picture-in-Picture window, which
                    takes the stage's children (see pip.ts). */}
                <div className="pipControls">
                    <button
                        className="transportBtn playBtn"
                        onclick={togglePlayPause}
                    >
                        <span visible={paused$}>
                            <Icon name="play_arrow" />
                        </span>
                        <span visible={paused$.map((p) => !p)}>
                            <Icon name="pause" />
                        </span>
                    </button>
                    <div
                        className="transportProgress"
                        visible={interstitialActive$.map((v) => !v)}
                    >
                        <span className="progressTime">{elapsed$}</span>
                        <div className="progressBar">
                            <ScrubBar
                                currentTimePercent$={currentTimePercent$}
                                fetchedTimePercent$={fetchedTimePercent$}
                                adBreaks$={adBreaks$}
                                seekRange$={seekRange$}
                                onSeek={seekToPercent}
                            />
                        </div>
                        <span className="progressTime">{remaining$}</span>
                    </div>
                </div>
            </div>
            <div className="transportControlsRow">
                <div className="transportControls">
                    <button
                        className="transportBtn playBtn"
                        classList={[
                            loading$.map((loading) =>
                                loading ? 'loading' : null
                            ),
                        ]}
                        onclick={togglePlayPause}
                    >
                        <span visible={paused$}>
                            <Icon name="play_arrow" />
                        </span>
                        <span visible={paused$.map((p) => !p)}>
                            <Icon name="pause" />
                        </span>
                    </button>
                </div>
                <div
                    className="transportProgress"
                    visible={interstitialActive$.map((v) => !v)}
                >
                    <span className="progressTime">{elapsed$}</span>
                    <div className="progressBar">
                        <ScrubBar
                            currentTimePercent$={currentTimePercent$}
                            fetchedTimePercent$={fetchedTimePercent$}
                            adBreaks$={adBreaks$}
                            seekRange$={seekRange$}
                            onSeek={seekToPercent}
                        />
                    </div>
                    <span className="progressTime">{remaining$}</span>
                </div>
                {/* Spacer keeps the surrounding controls in place while the
                    scrub bar is hidden during interstitial ad playback. */}
                <div
                    className="transportProgressSpacer"
                    visible={interstitialActive$}
                />
                <div className="transportTrackInfo">
                    <div className="trackTitle">
                        {track$.map((t) => t?.title ?? '')}
                    </div>
                    <div className="trackType">
                        {track$.map((t) => t?.type ?? '')}
                    </div>
                </div>
                <div className="transportActions">
                    <SettingsControl />
                    <button
                        className="transportBtn"
                        title="Fullscreen"
                        visible={hasVideo$}
                        onclick={toggleFullscreen}
                    >
                        <Icon name="fullscreen" />
                    </button>
                </div>
                <VolumeControl
                    muted$={muted$}
                    volume$={volume$}
                    onMutedChange={(muted) => (player.muted = muted)}
                    onVolumeChange={(vol) => {
                        player.volume = vol
                        player.muted = vol === 0
                    }}
                />

                <button
                    className="transportBtn"
                    title="Close"
                    onclick={() => {
                        // Leave fullscreen first — the transport (and its
                        // fullscreen target) is torn down on unload.
                        if (document.fullscreenElement) {
                            document.exitFullscreen().catch(() => {})
                        }
                        unloadTrack()
                    }}
                >
                    <Icon name="close" />
                </button>
            </div>
        </footer>
    )
}

function formatTime(seconds: number): string {
    if (!seconds || seconds < 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}
