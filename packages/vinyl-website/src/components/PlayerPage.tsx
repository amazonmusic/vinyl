import { jsx } from '@amazon/vinyl-tsx'
import {
    createTrackFromUrl,
    enqueueContent,
    loadContent,
    type Track,
} from '../player'
import { data } from '@amazon/vinyl-observable'
import { Icon } from './icons'
import { toastError } from './toast'

const demoTracks: Track[] = [
    {
        title: 'Audio Only (DASH)',
        type: 'dash',
        contentType: 'audio',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/world___bpm85/manifest.mpd`,
        description: 'DASH audio-only stream',
    },
    {
        title: 'Video + Audio (DASH)',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/live_static_video_audio_60s_4s_segmentTemplate/manifest.mpd`,
        description: '60s DASH segment template, video and audio',
    },
    {
        title: 'Video + Audio fMP4 (HLS)',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/live_static_video_audio_60s_4s/main.m3u8`,
        description: '60s HLS video and audio stream',
    },
    {
        title: 'Video + Audio MPEGTS (HLS)',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/live_static_video_audio_60s_4s_mpegts/main.m3u8`,
        description: '60s HLS video and audio mpegts stream with transmuxing',
    },
]

// HLS Interstitial (SGAI) test streams. Each carries a different ad-break
// configuration embedded in the manifest, so they load like any other HLS
// track — no separate ad config is passed to the player. Grouped into a
// collapsed section below; descriptions state what each scenario exercises.
const adBreakTracks: Track[] = [
    {
        title: 'Apple SGAI Sample',
        type: 'hls',
        contentType: 'video',
        url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/interstitial-sample/mvp_interstitial_sample.m3u8',
        description:
            "Apple's public HLS Interstitials sample — SGAI ad breaks against real-world content.",
    },
    {
        title: 'Pre + Mid + Post Roll',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/single_uri_pre_mid_post.m3u8`,
        description:
            'Preroll, midroll, and postroll — each a single-URI interstitial. Baseline three-slot ad placement.',
    },
    {
        title: 'Asset-List Midroll',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/asset_list_midroll.m3u8`,
        description:
            'Midroll delivered via X-ASSET-LIST: multiple ads resolved from an asset list in one break.',
    },
    {
        title: 'Empty Breaks',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/empty_breaks_pre_mid_post.m3u8`,
        description:
            'Pre/mid/post breaks that resolve to no ads — verifies graceful empty-break handling (no stall).',
    },
    {
        title: 'Cue-Once Midroll',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/cue_once_midroll.m3u8`,
        description:
            'Midroll marked CUE=ONCE — plays the first time only, skipped on replay or seek-back.',
    },
    {
        title: 'Skip / Jump Restricted',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/restrict_skip_and_jump.m3u8`,
        description:
            'Two midrolls: the first (~0:40) sets X-RESTRICT=SKIP so its ad cannot be skipped; the second (~1:30) sets X-RESTRICT=JUMP so playback cannot seek across its ad.',
    },
    {
        title: 'Long Preroll → Early Midroll',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/long_preroll_early_midroll.m3u8`,
        description:
            'Long preroll immediately followed by an early midroll — coverage for scheduling a midroll right after a preroll.',
    },
    {
        title: 'Resume Offset + Playout Limit',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/resume_offset_and_playout_limit.m3u8`,
        description:
            'Break using X-RESUME-OFFSET and X-PLAYOUT-LIMIT to control the resume point and cap ad playout duration.',
    },
    {
        title: 'Base Content (no ads)',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_av/main.m3u8`,
        description:
            'Ad-break base stream with no interstitials — control for comparing against the scenarios above.',
    },
    {
        title: 'Pre + Mid + Post Roll (audio)',
        type: 'hls',
        contentType: 'audio',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_audio/single_uri_pre_mid_post.m3u8`,
        description: 'Audio-only preroll, midroll, and postroll interstitials.',
    },
    {
        title: 'Asset-List Midroll (audio)',
        type: 'hls',
        contentType: 'audio',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_audio/asset_list_midroll.m3u8`,
        description: 'Audio-only midroll resolved from an X-ASSET-LIST.',
    },
    {
        title: 'Empty Breaks (audio)',
        type: 'hls',
        contentType: 'audio',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/vinyl_ad_breaks_audio/empty_breaks_pre_mid_post.m3u8`,
        description: 'Audio-only pre/mid/post breaks that resolve to no ads.',
    },
]

export function PlayerPage() {
    const url$ = data('')
    // Resolves the currently typed URL to a track, then hands it to `sink`
    // (play now or enqueue).
    const withUrlTrack = (sink: (track: Track) => void) => {
        const url = url$.value.trim()
        if (!url) return
        createTrackFromUrl(url)
            .then((track) => {
                if (!track) {
                    toastError('Could not determine media type for URL')
                    return
                }
                sink(track)
            })
            .catch(toastError)
    }
    const loadUrl = () => withUrlTrack(loadContent)
    const enqueueUrl = () => withUrlTrack(enqueueContent)

    return (
        <div className="page">
            <div className="pageHeader">
                <h1>Player</h1>
                <div className="subtitle">
                    Load content by URL or play a demo track
                </div>
            </div>

            <div className="card">
                <div className="cardHeader">
                    <h2>Add Content</h2>
                </div>
                <div className="urlRow">
                    <input
                        className="textInput"
                        type="text"
                        placeholder="Enter manifest URL (.mpd, .m3u8) or media source"
                        oninput={(e) => {
                            url$.value = (
                                e.currentTarget as HTMLInputElement
                            ).value
                        }}
                        onkeydown={(e) => {
                            if (e.key === 'Enter') loadUrl()
                        }}
                    />
                    <button className="btn btnPrimary" onclick={loadUrl}>
                        <Icon name="play_arrow" />
                        Play
                    </button>
                    <button
                        className="btnIcon"
                        title="Add to queue"
                        aria-label="Add to queue"
                        onclick={enqueueUrl}
                    >
                        <Icon name="add" />
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="cardHeader">
                    <h2>Demo Tracks</h2>
                </div>
                <DemoGrid tracks={demoTracks} />
            </div>

            <div className="card">
                {/* Collapsed by default: `details` with no `open` attribute. */}
                <details className="adBreakSection">
                    <summary className="adBreakSummary">
                        <Icon name="chevron_right" />
                        <div className="adBreakSummaryText">
                            <h2>Ad-Break Test Streams</h2>
                            <div className="subtitle">
                                HLS Interstitial (SGAI) scenarios — ad breaks
                                are embedded in the manifest
                            </div>
                        </div>
                    </summary>
                    <DemoGrid tracks={adBreakTracks} />
                </details>
            </div>
        </div>
    )
}

function DemoGrid(props: { readonly tracks: readonly Track[] }) {
    return (
        <div className="demoGrid">
            {...props.tracks.map((track) => <DemoCard track={track} />)}
        </div>
    )
}

function DemoCard(props: { readonly track: Track }) {
    const { track } = props
    const activate = () => loadContent(track)
    return (
        <div
            className="demoCard"
            role="button"
            tabIndex={0}
            aria-label={`Play ${track.title ?? track.url}`}
            onclick={activate}
            onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    activate()
                }
            }}
        >
            <div className="demoCardIcon">
                <Icon
                    name={
                        track.contentType === 'video' ? 'movie' : 'audio_file'
                    }
                />
            </div>
            <div className="demoCardContent">
                <div className="demoCardTitle">{track.title ?? track.url}</div>
                <div className="demoCardDesc">{track.description ?? ''}</div>
            </div>
            <span className="badge">{track.type}</span>
            <button
                className="btnIcon"
                title="Add to queue"
                aria-label={`Add ${track.title ?? track.url} to queue`}
                onclick={(e: MouseEvent) => {
                    // Don't also trigger the card's play-on-click.
                    e.stopPropagation()
                    enqueueContent(track)
                }}
            >
                <Icon name="add" />
            </button>
        </div>
    )
}
