/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsx } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { playerState } from '../player'
import { Icon } from './icons'
import type { TextTrackInfo } from '@amazon/vinyl'

export function CaptionsControl() {
    const {
        player,
        textTracks$,
        activeTextTrack$,
        captionsEnabled$,
        preferredLanguage$,
    } = playerState
    const menuOpen$ = data(false)

    const visible$ = textTracks$.map((tracks) => tracks.length > 0)

    const closeMenu = () => (menuOpen$.value = false)

    const activateTrack = (info: TextTrackInfo) => {
        player.setActiveTextTrack(info.id)
        captionsEnabled$.value = true
        preferredLanguage$.value = info.language
    }

    const deactivate = () => {
        player.setActiveTextTrack(null)
        captionsEnabled$.value = false
    }

    const onCcClick = () => {
        const tracks = textTracks$.value
        const active = activeTextTrack$.value
        if (tracks.length > 1) {
            menuOpen$.value = !menuOpen$.value
        } else if (active) {
            deactivate()
        } else if (tracks.length === 1) {
            activateTrack(tracks[0])
        }
    }

    const selectTrack = (id: string | null) => {
        if (id == null) {
            deactivate()
        } else {
            const target = textTracks$.value.find((t) => t.id === id)
            if (target) activateTrack(target)
        }
        closeMenu()
    }

    return (
        <div className="captionsControl" visible={visible$}>
            <button
                className="transportBtn"
                classList={[activeTextTrack$.map((t) => (t ? 'active' : null))]}
                title="Captions"
                aria-label="Toggle captions"
                onclick={onCcClick}
            >
                <Icon name="closed_caption" />
            </button>
            <div
                className="captionsMenu"
                visible={menuOpen$}
                onConnect={(el) => {
                    const rebuild = (tracks: readonly TextTrackInfo[]) => {
                        el.replaceChildren(
                            renderItem('Off', null, selectTrack),
                            ...tracks.map((t) =>
                                renderItem(trackLabel(t), t.id, selectTrack)
                            )
                        )
                        applySelection(el, activeTextTrack$.value?.id ?? null)
                    }
                    const unTracks = textTracks$.onData(rebuild)
                    rebuild(textTracks$.value)
                    const unActive = activeTextTrack$.onData((t) => {
                        applySelection(el, t?.id ?? null)
                    })
                    // Close the menu when a click lands outside it. The listener
                    // is attached only while the menu is open, and its attach is
                    // deferred one tick so the click that opened the menu (still
                    // bubbling to the document) does not immediately close it.
                    // This element is persistent and merely toggled via
                    // `visible`, so onConnect runs once; driving the listener off
                    // `menuOpen$` is what scopes it to each open.
                    const onDocClick = (e: MouseEvent) => {
                        if (!el.contains(e.target as Node)) closeMenu()
                    }
                    let timerId: ReturnType<typeof setTimeout> | null = null
                    const detachDocClick = () => {
                        if (timerId != null) {
                            clearTimeout(timerId)
                            timerId = null
                        }
                        document.removeEventListener('click', onDocClick)
                    }
                    const unMenuOpen = menuOpen$.onData((open) => {
                        detachDocClick()
                        if (open) {
                            timerId = setTimeout(() => {
                                timerId = null
                                document.addEventListener('click', onDocClick)
                            }, 0)
                        }
                    })
                    return () => {
                        detachDocClick()
                        unMenuOpen()
                        unTracks()
                        unActive()
                    }
                }}
            />
        </div>
    )
}

function renderItem(
    label: string,
    id: string | null,
    onSelect: (id: string | null) => void
): HTMLElement {
    const btn = (
        <button
            className="captionsMenuItem"
            onclick={() => onSelect(id)}
            data-track-id={id ?? '__off__'}
        >
            {label}
        </button>
    )
    return btn
}

function applySelection(menu: HTMLElement, activeId: string | null): void {
    const key = activeId ?? '__off__'
    for (const child of Array.from(menu.children)) {
        const el = child as HTMLElement
        el.classList.toggle('selected', el.dataset.trackId === key)
    }
}

function trackLabel(t: TextTrackInfo): string {
    if (t.label && t.language) return `${t.label} (${t.language})`
    return t.label || t.language || t.id
}
