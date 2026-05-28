import { jsx } from '@amazon/vinyl-tsx'
import { isDark$, toggleTheme } from '@/app'
import { navigateTo, onNavigate } from '@/router/router'
import { Icon, type IconName } from '@/components/icons'

export function Sidebar() {
    const overviewLink = <NavItem icon="dashboard" label="Overview" path="/" />
    const playerLink = (
        <NavItem icon="play_circle" label="Player" path="/player" />
    )
    const docsLink = (
        <NavItem icon="description" label="Documentation" path="/docs" />
    )

    function updateActive(path: string) {
        overviewLink.classList.toggle('active', path === '/')
        playerLink.classList.toggle('active', path === '/player')
        docsLink.classList.toggle('active', path.startsWith('/docs'))
    }

    onNavigate((e) => updateActive(e.current))
    updateActive(
        window.location.hash.startsWith('#!')
            ? window.location.hash.substring(2) || '/'
            : '/'
    )

    const themeSwitch = (
        <div
            className="themeSwitch"
            role="switch"
            tabIndex={0}
            aria-checked={isDark$.value ? 'true' : 'false'}
            aria-label="Dark mode"
            onclick={toggleTheme}
            onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleTheme()
                }
            }}
        >
            <Icon name="dark_mode" />
            <span>Dark mode</span>
            <div className="switchTrack">
                <div className="switchThumb" />
            </div>
        </div>
    )

    isDark$.onData((dark) => {
        themeSwitch.classList.toggle('dark', dark)
        themeSwitch.setAttribute('aria-checked', String(dark))
    })

    return (
        <aside className="sidebar">
            <a className="logo" href="#!/">
                <img src="./img/logo-64.png" alt="Amazon Vinyl" />
                <span>Amazon Vinyl</span>
            </a>
            <nav role="menu" aria-label="Main navigation">
                {overviewLink}
                {playerLink}
                {docsLink}
                <ExternalNavItem
                    icon="code"
                    label="API Docs"
                    href="tsdocs/index.html"
                />
                <ExternalNavItem
                    icon="github"
                    label="GitHub"
                    href="https://github.com/amazonmusic/vinyl"
                />
            </nav>
            <div className="themeToggle">{themeSwitch}</div>
        </aside>
    )
}

function NavItem(props: { icon: IconName; label: string; path: string }) {
    const activate = () => {
        navigateTo(props.path)
        document.querySelector('.sidebar')?.classList.remove('open')
        document.querySelector('.sidebarOverlay')?.classList.remove('open')
    }
    return (
        <a
            className="navItem"
            role="menuitem"
            tabIndex={0}
            onclick={activate}
            onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    activate()
                }
            }}
        >
            <Icon name={props.icon} />
            {props.label}
        </a>
    )
}

function ExternalNavItem(props: {
    icon: IconName
    label: string
    href: string
}) {
    return (
        <a
            className="navItem"
            href={props.href}
            target="_blank"
            rel="noopener"
            role="menuitem"
            tabIndex={0}
        >
            <Icon name={props.icon} />
            {props.label}
        </a>
    )
}
