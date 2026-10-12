import { jsx } from '@amazon/vinyl-tsx'
import {
    createQueueLink,
    createTrackFromUrl,
    type DemoTrack,
    enqueueContent,
    loadContent,
    playerState,
    removeFromQueue,
    trackDisplay,
    type TrackType,
} from '../player'
import {
    DrmKeySystem,
    type DrmOptions,
    type TrackLoadOptions,
} from '@amazon/vinyl'
import { data } from '@amazon/vinyl-observable'
import { Icon } from './icons'
import { toast, toastError } from './toast'

const TYPE_OPTIONS: readonly (TrackType | 'auto')[] = [
    'auto',
    'dash',
    'hls',
    'src',
]

const KEY_SYSTEM_OPTIONS: readonly { value: DrmKeySystem; label: string }[] = [
    { value: DrmKeySystem.WIDEVINE, label: 'Widevine' },
    { value: DrmKeySystem.PLAY_READY, label: 'PlayReady' },
    { value: DrmKeySystem.FAIR_PLAY, label: 'FairPlay' },
    { value: DrmKeySystem.CLEAR_KEY, label: 'Clear Key' },
]

const demoTracks: DemoTrack[] = [
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
const adBreakTracks: DemoTrack[] = [
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

// Stitched (SSAI) streams signalled with SCTE-35, and DASH alternative MPD
// (SGAI) streams. Stitched ads play within the content timeline; the scrub
// bar shows them in orange.
const ssaiTracks: DemoTrack[] = [
    {
        title: 'DASH SCTE-35 Midroll (xml+bin)',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/ssai_scte35_xmlbin/stream.mpd`,
        description:
            'Multi-Period SSAI: a 15s ad Period at 1:00 signalled by a urn:scte:scte35:2014:xml+bin splice_insert event.',
    },
    {
        title: 'DASH SCTE-35 Midroll (xml)',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/ssai_scte35_xml/stream.mpd`,
        description:
            'The same midroll signalled by a urn:scte:scte35:2013:xml SpliceInfoSection event.',
    },
    {
        title: 'DASH SCTE-35 Pod (time_signal)',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/ssai_pod_time_signal/stream.mpd`,
        description:
            'A 25s pod of two ad Periods at 1:00, signalled by a time_signal placement opportunity.',
    },
    {
        title: 'DASH SCTE-35 Pre + Mid + Post',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/ssai_pre_mid_post/stream.mpd`,
        description:
            'Stitched preroll (0:00), midroll (1:30), and postroll (3:20), each its own ad Period.',
    },
    {
        title: 'HLS SCTE-35 Midroll (OUT/IN)',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/ssai_scte35/main.m3u8`,
        description:
            'A 15s ad stitched at 1:00 behind EXT-X-DISCONTINUITY, signalled by SCTE35-OUT and SCTE35-IN date ranges.',
    },
    {
        title: 'HLS SCTE-35 Pod (CMD)',
        type: 'hls',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/hls/ssai_scte35_cmd/main.m3u8`,
        description:
            'A 25s two-ad pod at 1:00, signalled by a SCTE35-CMD time_signal date range.',
    },
    {
        title: 'DASH Alternative MPD Insert',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/altmpd_insert/stream.mpd`,
        description:
            'SGAI: InsertPresentation preroll and 1:00 midroll, played as separate ad presentations.',
    },
    {
        title: 'DASH Alternative MPD Replace',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/altmpd_replace/stream.mpd`,
        description:
            'SGAI: ReplacePresentation at 1:00 replacing 15s of content; content resumes at 1:15.',
    },
    {
        title: 'DASH Alternative MPD List Pod',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/altmpd_list/stream.mpd`,
        description:
            'SGAI: InsertPresentation at 1:00 whose uri is a list MPD of a two-ad pod, played as two ads.',
    },
    {
        title: 'DASH List MPD',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/list_mpd/stream.mpd`,
        description:
            'A list MPD of three Linked Periods: an imported preroll, the content, and a postroll. The ad Periods carry SCTE-35, so they are stitched breaks.',
    },
    {
        title: 'DASH XLink Remote Period',
        type: 'dash',
        contentType: 'video',
        url: `https://assets.dev.vinyl.music.amazon.dev/dash/xlink_remote_period/stream.mpd`,
        description:
            'A remote Period (xlink:actuate="onRequest") resolving to a stitched SCTE-35 pod at 1:00, and a resolve-to-zero Period.',
    },
]

export function PlayerPage() {
    const url$ = data('')
    const title$ = data('')
    const type$ = data<TrackType | 'auto'>('auto')
    const keySystem$ = data<DrmKeySystem>(DrmKeySystem.WIDEVINE)
    const licenseServerUrl$ = data('')
    const serverCertificateUrl$ = data('')

    // Builds a DRM configuration from the settings fields, fetching the service
    // certificate to bytes when a URL is given. Returns undefined when no
    // license server is set, so unprotected content is unaffected. Keyed by the
    // selected key system; the DemoTrack config still allows configuring every key
    // system programmatically.
    const buildDrmOptions = async (): Promise<
        Partial<DrmOptions> | undefined
    > => {
        const url = licenseServerUrl$.value.trim()
        if (!url) return undefined
        const certUrl = serverCertificateUrl$.value.trim()
        const serverCertificate = certUrl
            ? await fetch(certUrl).then((r) => r.arrayBuffer())
            : undefined
        return {
            keySystems: {
                [keySystem$.value]: {
                    licenseServer: {
                        url,
                        ...(serverCertificate && { serverCertificate }),
                    },
                },
            },
        }
    }

    // Resolves the currently typed URL to a track, then hands it to `sink`
    // (play now or enqueue).
    const withUrlTrack = async (sink: (track: DemoTrack) => void) => {
        const url = url$.value.trim()
        if (!url) return
        const drm = await buildDrmOptions()
        const track = await createTrackFromUrl(url, {
            type: type$.value,
            ...(title$.value.trim() && { title: title$.value.trim() }),
            ...(drm && { drm }),
        })
        if (!track) {
            toastError('Could not determine media type for URL')
            return
        }
        sink(track)
    }
    const loadUrl = () => {
        withUrlTrack(loadContent).catch(toastError)
    }
    const enqueueUrl = () => {
        withUrlTrack(enqueueContent).catch(toastError)
    }

    const bindValue = (target: { value: string }) => (e: Event) => {
        target.value = (
            e.currentTarget as HTMLInputElement | HTMLSelectElement
        ).value
    }

    return (
        <div className="page">
            <div className="card">
                <div className="cardHeader">
                    <h2>Add Content</h2>
                </div>
                {/* A real form so the browser records field values for native
                    autocomplete: named inputs are remembered on submit (Enter
                    or Play). We preventDefault to keep it a client-side load. */}
                <form
                    autocomplete="on"
                    onsubmit={(e: Event) => {
                        e.preventDefault()
                        loadUrl()
                    }}
                >
                    <div className="urlRow">
                        <input
                            className="textInput"
                            type="text"
                            name="manifestUrl"
                            autocomplete="on"
                            aria-label="Manifest or media source URL"
                            placeholder="Enter manifest URL (.mpd, .m3u8) or media source"
                            oninput={(e) => {
                                url$.value = (
                                    e.currentTarget as HTMLInputElement
                                ).value
                            }}
                        />
                        <button className="btn btnPrimary" type="submit">
                            <Icon name="play_arrow" />
                            Play
                        </button>
                        <button
                            className="btnIcon"
                            type="button"
                            title="Add to queue"
                            aria-label="Add to queue"
                            onclick={enqueueUrl}
                        >
                            <Icon name="add" />
                        </button>
                    </div>

                    {/* Collapsed by default: `details` with no `open` attribute. */}
                    <details className="trackSettings">
                        <summary className="trackSettingsSummary">
                            <Icon name="chevron_right" />
                            <span>Track settings (title, type, DRM)</span>
                        </summary>
                        <div className="settingsGrid">
                            <label className="settingsField settingsFieldWide">
                                <span className="settingsLabel">
                                    Title (display only)
                                </span>
                                <input
                                    className="textInput"
                                    type="text"
                                    name="trackTitle"
                                    autocomplete="on"
                                    aria-label="Track title"
                                    placeholder="Optional display name for this track"
                                    oninput={bindValue(title$)}
                                />
                            </label>
                            <label className="settingsField">
                                <span className="settingsLabel">Type</span>
                                <select
                                    className="selectInput"
                                    aria-label="Track type"
                                    onchange={bindValue(type$)}
                                >
                                    {TYPE_OPTIONS.map((t) => (
                                        <option value={t}>{t}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="settingsField">
                                <span className="settingsLabel">
                                    Key system
                                </span>
                                <select
                                    className="selectInput"
                                    aria-label="DRM key system"
                                    onchange={bindValue(keySystem$)}
                                >
                                    {KEY_SYSTEM_OPTIONS.map((k) => (
                                        <option value={k.value}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="settingsField settingsFieldWide">
                                <span className="settingsLabel">
                                    License server URL
                                </span>
                                <input
                                    className="textInput"
                                    type="text"
                                    name="licenseServerUrl"
                                    autocomplete="on"
                                    aria-label="License server URL"
                                    placeholder="https://…/proxy (leave blank for clear content)"
                                    oninput={bindValue(licenseServerUrl$)}
                                />
                            </label>
                            <label className="settingsField settingsFieldWide">
                                <span className="settingsLabel">
                                    Service certificate URL (optional)
                                </span>
                                <input
                                    className="textInput"
                                    type="text"
                                    name="serviceCertificateUrl"
                                    autocomplete="on"
                                    aria-label="Service certificate URL"
                                    placeholder="https://…/service-cert"
                                    oninput={bindValue(serverCertificateUrl$)}
                                />
                            </label>
                        </div>
                    </details>
                </form>
            </div>

            {/* Shown only when something is loaded: the current track followed
                by the upcoming queue. The list is rebuilt imperatively on each
                change (observable children render as text, so a reactive node
                list needs a manual update). */}
            <div
                className="card"
                visible={playerState.track$.map((t) => t != null)}
            >
                <div className="cardHeader">
                    <h2>Play Queue</h2>
                    <button
                        className="btnIcon"
                        type="button"
                        title="Copy link to this play queue"
                        aria-label="Copy link to this play queue"
                        disabled={playerState.track$.map((t) => t == null)}
                        onclick={copyQueueLink}
                    >
                        <Icon name="link" />
                    </button>
                </div>
                <div
                    className="demoGrid"
                    onConnect={(el) => {
                        const render = () => {
                            const current = playerState.track$.value
                            el.replaceChildren(
                                ...(current
                                    ? [<CurrentQueueItem track={current} />]
                                    : []),
                                ...playerState.queue$.value.map((item, i) =>
                                    QueueItem({ item, index: i })
                                )
                            )
                        }
                        render()
                        const unsubscribeTrack =
                            playerState.track$.onData(render)
                        const unsubscribeQueue =
                            playerState.queue$.onData(render)
                        return () => {
                            unsubscribeTrack()
                            unsubscribeQueue()
                        }
                    }}
                />
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

            <div className="card">
                <details className="adBreakSection">
                    <summary className="adBreakSummary">
                        <Icon name="chevron_right" />
                        <div className="adBreakSummaryText">
                            <h2>SSAI and DASH Ad Test Streams</h2>
                            <div className="subtitle">
                                Stitched SCTE-35 (DASH and HLS) and DASH
                                alternative MPD scenarios
                            </div>
                        </div>
                    </summary>
                    <DemoGrid tracks={ssaiTracks} />
                </details>
            </div>
        </div>
    )
}

function DemoGrid(props: { readonly tracks: readonly DemoTrack[] }) {
    return (
        <div className="demoGrid">
            {props.tracks.map((track) => (
                <DemoCard track={track} />
            ))}
        </div>
    )
}

function DemoCard(props: { readonly track: DemoTrack }) {
    const { track } = props
    // Two sibling buttons (play + queue) rather than a button-role card
    // wrapping a button, which would be a nested interactive control.
    return (
        <div className="demoCard">
            <button
                className="demoCardMain"
                type="button"
                aria-label={`Play ${track.title ?? track.url}`}
                onclick={() => loadContent(track)}
            >
                <div className="demoCardIcon">
                    <Icon
                        name={
                            track.contentType === 'video'
                                ? 'movie'
                                : 'audio_file'
                        }
                    />
                </div>
                <div className="demoCardContent">
                    <div className="demoCardTitle">
                        {track.title ?? track.url}
                    </div>
                    <div className="demoCardDesc">
                        {track.description ?? ''}
                    </div>
                </div>
                <span className="badge">{track.type}</span>
            </button>
            <button
                className="btnIcon"
                title="Add to queue"
                aria-label={`Add ${track.title ?? track.url} to queue`}
                onclick={() => enqueueContent(track)}
            >
                <Icon name="add" />
            </button>
        </div>
    )
}

/** Copies a link reproducing the current track and play queue. */
function copyQueueLink() {
    const link = createQueueLink()
    if (link == null) return
    navigator.clipboard
        .writeText(link)
        .then(() => toast('Play queue link copied'))
        .catch(() => toastError('Could not copy the link to the clipboard'))
}

/** The Play Queue's first row: the currently loaded track. */
function CurrentQueueItem(props: { readonly track: DemoTrack }) {
    const { track } = props
    return (
        <div className="demoCard">
            <div className="demoCardMain queueItemMain">
                <div className="demoCardIcon">
                    <Icon
                        name={
                            track.contentType === 'video'
                                ? 'movie'
                                : 'audio_file'
                        }
                    />
                </div>
                <div className="demoCardContent">
                    <div className="demoCardTitle">
                        {track.title ?? track.url}
                    </div>
                    <div className="demoCardDesc">{track.url}</div>
                </div>
                <span className="badge">Now playing</span>
                <span className="badge">{track.type}</span>
            </div>
        </div>
    )
}

/** A single row in the Play Queue, with a remove button. */
function QueueItem(props: {
    readonly item: TrackLoadOptions
    readonly index: number
}) {
    const { item, index } = props
    const display = trackDisplay(item)
    return (
        <div className="demoCard">
            <div className="demoCardMain queueItemMain">
                <div className="demoCardIcon">
                    <Icon
                        name={
                            display.contentType === 'video'
                                ? 'movie'
                                : 'audio_file'
                        }
                    />
                </div>
                <div className="demoCardContent">
                    <div className="demoCardTitle">{display.title}</div>
                    <div className="demoCardDesc">{item.uri}</div>
                </div>
                <span className="badge">{item.type}</span>
            </div>
            <button
                className="btnIcon"
                title="Remove from queue"
                aria-label={`Remove ${display.title} from queue`}
                onclick={() => removeFromQueue(index)}
            >
                <Icon name="close" />
            </button>
        </div>
    )
}
