import './polyfill'
import './styles/index.scss'
import { initializeLogging } from './initializeLogging'
import { jsx, Fragment, initializeConnectedObserver } from '@amazon/vinyl-tsx'
import { vinylVersion } from '@amazon/vinyl'
import { Sidebar } from './components/Sidebar'
import { TransportBar } from './components/TransportBar'
import { data } from '@amazon/vinyl-observable'
import { getRouter } from './router/router'
import { routes } from './routes'
import { Icon } from './components/icons'
import { playerState } from './player'

initializeLogging()
initializeConnectedObserver()

function getInitialTheme(): 'light' | 'dark' {
    const stored = localStorage.getItem('vinyl-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
}

const theme = getInitialTheme()
document.documentElement.setAttribute('data-theme', theme)
export const isDark$ = data(theme === 'dark')

export function toggleTheme() {
    const next = isDark$.value ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('vinyl-theme', next)
    isDark$.value = !isDark$.value
}

const app = document.getElementById('app')!

const sidebar = <Sidebar />
const overlay = <div className="sidebarOverlay" />

function toggleMenu() {
    sidebar.classList.toggle('open')
    overlay.classList.toggle('open')
}

overlay.addEventListener('click', toggleMenu)

const mobileHeader = (
    <header className="mobileHeader">
        <button className="menuBtn" onclick={toggleMenu}>
            <Icon name="menu" />
        </button>
        <img src="./img/logo-64.png" alt="Amazon Vinyl" />
        <span className="mobileTitle">
            Amazon Vinyl <span className="versionTag">v{vinylVersion.str}</span>
        </span>
        <a
            className="mobileGithub"
            href="https://github.com/amazonmusic/vinyl"
            target="_blank"
            rel="noopener"
        >
            <Icon name="github" />
        </a>
    </header>
)

const stage = <div className="stage" />

app.append(
    <>
        {mobileHeader}
        {overlay}
        {sidebar}
        {stage}
        <TransportBar visible={playerState.track$.map((v) => v != null)} />
    </>
)

getRouter().configure({ stage, routes })
