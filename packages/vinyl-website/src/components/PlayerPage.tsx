import { jsx } from '@amazon/vinyl-tsx'
import { createTrackFromUrl, loadContent, type Track } from '../player'
import { data } from '@amazon/vinyl-observable'
import { Icon } from './icons'
import { toastError } from './toast'

const ASSETS_HOST = 'https://assets.dev.vinyl.music.amazon.dev'

const demoTracks: Track[] = [
    {
        title: 'Audio Only (DASH)',
        type: 'dash',
        contentType: 'audio',
        url: `${ASSETS_HOST}/dash/world___bpm85/manifest.mpd`,
        description: 'DASH audio-only stream',
    },
    {
        title: 'Video + Audio (DASH)',
        type: 'dash',
        contentType: 'video',
        url: `${ASSETS_HOST}/dash/live_static_video_audio_60s_4s_segmentTemplate/manifest.mpd`,
        description: '60s DASH segment template, video and audio',
    },
    {
        title: 'Video + Audio fMP4 (HLS)',
        type: 'hls',
        contentType: 'video',
        url: `${ASSETS_HOST}/hls/live_static_video_audio_60s_4s/main.m3u8`,
        description: '60s HLS video and audio stream',
    },
    {
        title: 'Video + Audio MPEGTS (HLS)',
        type: 'hls',
        contentType: 'video',
        url: `${ASSETS_HOST}/hls/live_static_video_audio_60s_4s_mpegts/main.m3u8`,
        description: '60s HLS video and audio mpegts stream with transmuxing',
    },
]

export function PlayerPage() {
    const url$ = data('')
    // Loads the currently typed URL.
    const loadUrl = () => {
        const url = url$.value.trim()
        if (!url) return
        createTrackFromUrl(url)
            .then((track) => {
                if (!track) {
                    toastError('Could not determine media type for URL')
                    return
                }
                loadContent(track)
            })
            .catch(toastError)
    }

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
        </div>
    )
}
