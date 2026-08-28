/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import './polyfill'

// Progressive-enhancement layer for the statically generated pages: theme
// toggle, mobile menu, package-manager tabs, and (on /player) the interactive
// player demo. The page content itself is server-rendered HTML.

function setupTheme(): void {
    const html = document.documentElement
    const readDark = () => html.getAttribute('data-theme') === 'dark'
    const sync = (dark: boolean, control: HTMLElement) => {
        control.classList.toggle('dark', dark)
        control.setAttribute('aria-checked', String(dark))
    }
    const control = document.querySelector<HTMLElement>('.themeSwitch')
    if (!control) return
    // The toggle is hidden by default (it needs JS); reveal it now.
    document.querySelector('.themeToggle')?.removeAttribute('hidden')
    sync(readDark(), control)

    const toggle = () => {
        const next = readDark() ? 'light' : 'dark'
        html.setAttribute('data-theme', next)
        try {
            localStorage.setItem('vinyl-theme', next)
        } catch {
            // ignore storage failures (private mode, etc.)
        }
        sync(next === 'dark', control)
    }
    control.addEventListener('click', toggle)
    control.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
        }
    })
}

function setupMobileMenu(): void {
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.querySelector('.sidebarOverlay')
    const menuBtn = document.querySelector('.menuBtn')
    if (!sidebar || !overlay || !menuBtn) return
    const toggle = () => {
        sidebar.classList.toggle('open')
        overlay.classList.toggle('open')
    }
    menuBtn.addEventListener('click', toggle)
    overlay.addEventListener('click', toggle)
}

function setupPackageManagerTabs(): void {
    const container = document.querySelector('.pmTabs')
    if (!container) return
    const tabs = container.querySelectorAll<HTMLElement>('.tab[data-pm]')
    const blocks = container.querySelectorAll<HTMLElement>('[data-pm-code]')
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const pm = tab.dataset.pm
            tabs.forEach((t) => {
                const active = t === tab
                t.classList.toggle('active', active)
                t.setAttribute('aria-selected', String(active))
            })
            blocks.forEach((b) => {
                b.hidden = b.dataset.pmCode !== pm
            })
        })
    })
}

setupTheme()
setupMobileMenu()
setupPackageManagerTabs()

if (window.location.pathname.startsWith(import.meta.env.BASE_URL + 'player')) {
    void import('./playerApp')
}
