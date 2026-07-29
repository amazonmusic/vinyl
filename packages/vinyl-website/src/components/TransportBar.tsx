import type { JsxElementProps } from '@amazon/vinyl-tsx'
import { jsx } from '@amazon/vinyl-tsx'
import {
    playerState,
    seekToPercent,
    skipAd,
    togglePlayPause,
    unloadTrack,
} from '../player'
import type { LogTarget } from '@amazon/vinyl-util'
import { logDebug } from '@amazon/vinyl-util'
import { combineData, externalData } from '@amazon/vinyl-observable'
import { Icon } from './icons'
import { LIVE_DURATION } from '@amazon/vinyl'
import { ScrubBar } from './ScrubBar'
import { VolumeControl } from './VolumeControl'
import { CaptionsControl } from './CaptionsControl'

const target: LogTarget = {
    logPrefix: 'TransportBar',
}

export function TransportBar(props: JsxElementProps<'div'>) {
    const {
        player,
        media,
        currentTime$,
        currentTimePercent$,
        duration$,
        fetchedTimePercent$,
        loading$,
        paused$,
        seeking$,
        track$,
        volume$,
        muted$,
        hasVideo$,
        activeAdBreak$,
        adBreaks$,
        adRemaining$,
        seekRange$,
    } = playerState

    const adActive$ = activeAdBreak$.map((b) => b != null)
    const adRemainingLabel$ = adRemaining$.map(formatTime)
    const canSkipAd$ = activeAdBreak$.map((b) => {
        if (!b) return false
        return !b.restrict?.skip
    })
    const adLabel$ = activeAdBreak$.map((activeBreak) => {
        if (!activeBreak) return ''
        const breakAds = activeBreak.ads
        if (breakAds.length <= 1) return 'Ad'
        const time = player.currentTime
        const idx =
            breakAds.findIndex(
                (a) =>
                    a.startTime <= time &&
                    (a.duration == null || a.startTime + a.duration > time)
            ) + 1
        return `Ad ${idx || 1} / ${breakAds.length}`
    })

    const elapsed$ = currentTime$.map(formatTime)
    const remaining$ = currentTime$.map((t) => {
        const dur = duration$.value
        return dur > 0 && dur < LIVE_DURATION ? '-' + formatTime(dur - t) : ''
    })

    media.addEventListener('click', togglePlayPause)

    const inPip$ = externalData(false, (set) => {
        const onEnter = () => set(true)
        const onLeave = () => set(false)
        media.addEventListener('enterpictureinpicture', onEnter)
        media.addEventListener('leavepictureinpicture', onLeave)
        return () => {
            media.removeEventListener('enterpictureinpicture', onEnter)
            media.removeEventListener('leavepictureinpicture', onLeave)
        }
    })

    const showVideo$ = combineData({ hasVideo: hasVideo$, inPip: inPip$ }).map(
        ({ hasVideo, inPip }) => {
            logDebug(
                target,
                'show video',
                'hasVideo:',
                hasVideo,
                'inPip',
                inPip
            )
            return hasVideo && !inPip
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

    return (
        <footer
            className="transport"
            onConnect={(element) => {
                resizeObserver.observe(element)

                return () => {
                    resizeObserver.unobserve(element)
                    document.documentElement.style.setProperty(
                        '--transport-height',
                        '0px'
                    )
                }
            }}
            {...props}
        >
            <div className="transportVideo" visible={showVideo$}>
                {media}
                <div className="adOverlay" visible={adActive$}>
                    <span className="adBadge">{adLabel$}</span>
                    <span className="adRemaining">{adRemainingLabel$}</span>
                    <button
                        className="adSkipBtn"
                        visible={canSkipAd$}
                        onclick={skipAd}
                    >
                        Skip Ad
                    </button>
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
                    visible={adActive$.map((v) => !v)}
                >
                    <span className="progressTime">{elapsed$}</span>
                    <div className="progressBar">
                        <ScrubBar
                            currentTimePercent$={currentTimePercent$}
                            fetchedTimePercent$={fetchedTimePercent$}
                            seeking$={seeking$}
                            adBreaks$={adBreaks$}
                            seekRange$={seekRange$}
                            onSeek={seekToPercent}
                        />
                    </div>
                    <span className="progressTime">{remaining$}</span>
                </div>
                {/* Spacer keeps the surrounding controls in place while the
                    scrub bar is hidden during ad playback. */}
                <div className="transportProgressSpacer" visible={adActive$} />
                <div className="transportTrackInfo">
                    <div className="trackTitle">
                        {track$.map((t) => t?.title)}
                    </div>
                    <div className="trackType">
                        {track$.map((t) => t?.type)}
                    </div>
                </div>
                <div className="transportActions">
                    <CaptionsControl />
                    <button
                        className="transportBtn"
                        title="Picture in Picture"
                        visible={hasVideo$}
                        onclick={() => {
                            if (document.pictureInPictureElement) {
                                document.exitPictureInPicture().catch(() => {})
                            } else {
                                media.requestPictureInPicture().catch(() => {})
                            }
                        }}
                    >
                        <Icon name="picture_in_picture_alt" />
                    </button>
                    <button
                        className="transportBtn"
                        title="Fullscreen"
                        visible={hasVideo$}
                        onclick={() => {
                            if (document.fullscreenElement) {
                                document.exitFullscreen().catch(() => {})
                            } else {
                                media.requestFullscreen().catch(() => {})
                            }
                        }}
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
                    onclick={unloadTrack}
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
