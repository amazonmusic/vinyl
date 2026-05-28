import { jsx } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { Icon } from './icons'
import { navigateTo } from '../router/router'

type PackageManager = 'npm' | 'yarn'

export function OverviewPage() {
    return (
        <div className="page">
            <div className="heroSection">
                <img
                    src="./img/logo-256.png"
                    alt="Amazon Vinyl"
                    className="heroLogo"
                />
                <div className="heroText">
                    <h1 className="heroTitle">Amazon Vinyl</h1>
                    <p className="heroSubtitle">
                        A high-performance HTML5 streaming engine for DASH and
                        HLS.
                    </p>
                </div>
            </div>

            <div className="statsGrid">
                <Stat value="75 KiB" label="Size (Gzipped)" />
                <Stat value="100%" label="Coverage" />
                <Stat value="0" label="Dependencies" />
                <Stat value="99.9%" label="Browser Support" />
            </div>

            <div className="card">
                <div className="cardHeader">
                    <h2>Features</h2>
                </div>
                <div className="featureList">
                    <Feature text="DASH & HLS adaptive streaming" />
                    <Feature text="Widevine, FairPlay & PlayReady DRM" />
                    <Feature text="Adaptive bitrate selection" />
                    <Feature text="Gapless track transitions" />
                    <Feature text="UHD audio up to 192kHz" />
                    <Feature text="Zero runtime dependencies" />
                    <Feature text="Full TypeScript support" />
                </div>
            </div>

            <div className="card">
                <div className="cardHeader">
                    <h2>Compatibility</h2>
                </div>
                <table className="compatTable">
                    <thead>
                        <tr>
                            <th>Browser</th>
                            <th>Support</th>
                        </tr>
                    </thead>
                    <tbody>
                        <Row browser="Chrome" support="v52+" />
                        <Row browser="Firefox" support="v52+" />
                        <Row browser="Safari" support="HLS v11+, Dash v17+" />
                        <Row browser="Edge" support="v18+" />
                        <Row browser="Chromium" support="v52+" />
                    </tbody>
                </table>
            </div>
            <div className="card">
                <div className="cardHeader">
                    <h2>Getting Started</h2>
                </div>
                <div className="markdown">
                    <h3>Installation</h3>
                    <InstallSnippet />

                    <h3>Basic Usage</h3>
                    <pre>
                        <code
                            className="hljs language-typescript"
                            innerHTML={highlightTs`import { createVinylPlayer } from '@amazon/vinyl'

const media = new Audio()
media.controls = true
document.body.appendChild(media)

const player = createVinylPlayer({ media })
player.load({
    type: 'dash',
    uri: 'https://assets.dev.vinyl.music.amazon.dev/dash/live_static_video_audio_60s_4s_segmentTemplate/manifest.mpd',
})`}
                        />
                    </pre>
                    <p>
                        See the{' '}
                        <a
                            href="#!/docs/vinyl-usage"
                            onclick={(e: MouseEvent) => {
                                e.preventDefault()
                                navigateTo('/docs/vinyl-usage')
                            }}
                        >
                            full usage guide
                        </a>{' '}
                        for HLS, DRM, preloading, queueing, and advanced
                        configuration.
                    </p>
                </div>
            </div>
        </div>
    )
}

function InstallSnippet() {
    const pm$ = data<PackageManager>('npm')
    return (
        <div>
            <div className="tabs">
                <PmTab pm="npm" pm$={pm$} />
                <PmTab pm="yarn" pm$={pm$} />
            </div>
            <pre>
                <code
                    className="hljs language-shell"
                    innerHTML={highlightShell`npm install @amazon/vinyl`}
                    visible={pm$.map((pm) => pm === 'npm')}
                />
                <code
                    className="hljs language-shell"
                    innerHTML={highlightShell`yarn add @amazon/vinyl`}
                    visible={pm$.map((pm) => pm === 'yarn')}
                />
            </pre>
        </div>
    )
}

function PmTab(props: {
    pm: PackageManager
    pm$: ReturnType<typeof data<PackageManager>>
}) {
    const tab = (
        <button
            className="tab"
            type="button"
            role="tab"
            onclick={() => (props.pm$.value = props.pm)}
        >
            {props.pm}
        </button>
    )
    props.pm$.onData((current) => {
        const isActive = current === props.pm
        tab.classList.toggle('active', isActive)
        tab.setAttribute('aria-selected', String(isActive))
    })
    return tab
}

function Stat(props: { value: string; label: string }) {
    return (
        <div className="statCard">
            <div className="statValue">{props.value}</div>
            <div className="statLabel">{props.label}</div>
        </div>
    )
}

function Feature(props: { text: string }) {
    return (
        <div className="featureItem">
            <Icon name="check_circle" />
            {props.text}
        </div>
    )
}

function Row(props: { browser: string; support: string }) {
    return (
        <tr>
            <td>{props.browser}</td>
            <td>
                <span className="badge">{props.support}</span>
            </td>
        </tr>
    )
}
