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
    {
        title: 'Ad Interstitials (HLS)',
        type: 'hls',
        contentType: 'video',
        url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/interstitial-sample/mvp_interstitial_sample.m3u8',
        description: 'Apple HLS Interstitials sample with SGAI ad breaks',
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
                <DemoGrid />
            </div>
        </div>
    )
}

function DemoGrid() {
    return (
        <div className="demoGrid">
            {...demoTracks.map((track) => <DemoCard track={track} />)}
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
